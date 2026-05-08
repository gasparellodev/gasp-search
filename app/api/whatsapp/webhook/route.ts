import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  normalizePhone,
  parseWebhookPayload,
  verifyHmac,
  type ParsedWebhookEvent,
} from "@/lib/evolution/webhook";
import { createServiceSupabase } from "@/lib/supabase/service";

// Endpoint público — sem cookie de sessão. Autenticidade vem do HMAC do header
// "x-evolution-signature" (sha256 do raw body com EVOLUTION_WEBHOOK_SECRET).
// Usa service_role pra escrever mas SEMPRE filtra por user_id resolvido via
// `whatsapp_instances.evo_instance` lookup.
//
// Sempre retorna 200 quando o payload é válido, mesmo se evento for unknown
// ou sem efeito — Evolution retransmite em qualquer não-2xx, o que vai gerar
// duplicatas idempotência depende mas barulho desnecessário também.

const SIGNATURE_HEADERS = [
  "x-evolution-signature",
  "x-hub-signature-256",
  "x-signature",
];

function pickSignature(headers: Headers): string | null {
  for (const name of SIGNATURE_HEADERS) {
    const v = headers.get(name);
    if (v) return v;
  }
  return null;
}

async function lookupUserByInstance(
  supabase: ReturnType<typeof createServiceSupabase>,
  instance: string,
): Promise<{ userId: string; status: string } | null> {
  const { data } = await supabase
    .from("whatsapp_instances")
    .select("user_id, status")
    .eq("evo_instance", instance)
    .maybeSingle();
  if (!data) return null;
  return { userId: data.user_id, status: data.status };
}

async function resolveLeadForInbound(
  supabase: ReturnType<typeof createServiceSupabase>,
  userId: string,
  phone: string,
): Promise<{ id: string; stage: string } | null> {
  // Lead pode estar com phone OU whatsapp populado. Buscamos os dois.
  const { data } = await supabase
    .from("leads")
    .select("id, stage, phone, whatsapp")
    .eq("user_id", userId);
  if (!data) return null;
  for (const lead of data) {
    const a = normalizePhone(lead.phone);
    const b = normalizePhone(lead.whatsapp);
    if (a === phone || b === phone) {
      return { id: lead.id, stage: lead.stage };
    }
  }
  return null;
}

async function handleEvent(
  supabase: ReturnType<typeof createServiceSupabase>,
  event: ParsedWebhookEvent,
) {
  if (event.type === "unknown") return;

  const ctx = await lookupUserByInstance(supabase, event.instance);

  if (event.type === "connection.update") {
    if (!ctx) return; // instância não conhecida — descartar
    type WhatsappStatus =
      | "connected"
      | "disconnected"
      | "connecting"
      | "error"
      | "qr_pending";
    const map: Record<typeof event.status, WhatsappStatus> = {
      open: "connected",
      close: "disconnected",
      connecting: "connecting",
      qrReadError: "error",
    };
    await supabase
      .from("whatsapp_instances")
      .update({
        status: map[event.status],
        phone_number: event.phoneNumber,
        last_seen_at: new Date().toISOString(),
      })
      .eq("evo_instance", event.instance);
    return;
  }

  if (event.type === "message.status") {
    // Status update — não exige user lookup, basta whatsapp_msg_id.
    await supabase
      .from("lead_messages")
      .update({ status: event.status })
      .eq("whatsapp_msg_id", event.messageId);
    return;
  }

  if (event.type === "message.upsert") {
    if (!ctx) return; // sem user → não conseguimos resolver lead
    if (event.fromMe) return; // outbound já gravamos no send.ts
    const lead = await resolveLeadForInbound(supabase, ctx.userId, event.from);
    if (!lead) {
      // Mensagem de número que não está nos leads do user — ignoramos no MVP.
      // Fase futura: criar lead automático ou inbox "outros números".
      return;
    }
    // INSERT idempotente pelo UNIQUE de whatsapp_msg_id.
    const { error: insertErr } = await supabase.from("lead_messages").insert({
      lead_id: lead.id,
      user_id: ctx.userId,
      channel: "whatsapp",
      content: event.content,
      direction: "inbound",
      status: "delivered",
      whatsapp_msg_id: event.messageId,
      ai_generated: false,
    });
    if (insertErr) {
      // Se já existe, OK — idempotência via UNIQUE. Outros erros logamos.
      if (!String(insertErr.message ?? "").includes("duplicate")) {
        console.warn(
          JSON.stringify({
            level: "warn",
            route: "POST /api/whatsapp/webhook",
            message: insertErr.message,
          }),
        );
      }
      return;
    }

    if (lead.stage === "new" || lead.stage === "contacted") {
      await supabase
        .from("leads")
        .update({ stage: "in_conversation" })
        .eq("id", lead.id);
    }
    return;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = pickSignature(request.headers);

  if (!verifyHmac(rawBody, signature, env.EVOLUTION_WEBHOOK_SECRET ?? "")) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const event = parseWebhookPayload(payload);
  if (event.type === "unknown") {
    // Aceita mas não processa — evita retransmissão.
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  try {
    const supabase = createServiceSupabase();
    await handleEvent(supabase, event);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "POST /api/whatsapp/webhook",
        message: error instanceof Error ? error.message : "webhook handler failed",
      }),
    );
    // Retornamos 500 pra Evolution retransmitir.
    return NextResponse.json(
      { error: "internal" },
      { status: 500 },
    );
  }
}
