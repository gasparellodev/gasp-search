import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  extractInstanceFromRoot,
  normalizePhone,
  parseWebhookPayload,
  verifyHmac,
  type ParsedWebhookEvent,
} from "@/lib/evolution/webhook";
import { createServiceSupabase } from "@/lib/supabase/service";

// Endpoint público — sem cookie de sessão. Autenticidade vem de dois caminhos:
//
//   1. HMAC do header de assinatura (originador assina o raw body com
//      EVOLUTION_WEBHOOK_SECRET). Caminho preferido em produção.
//   2. Fallback compatível com Evolution v2 que não assina nativamente:
//      o `instance` do payload precisa bater com uma row de
//      `whatsapp_instances` criada via rota autenticada
//      `POST /api/whatsapp/instance`.
//
// **#130 — auth hardening:** o lookup de `lookupUserByInstance` agora
// roda ANTES do short-circuit de eventos `unknown`. Sem isso, o handler
// vazava presença/ausência de HMAC para qualquer atacante. Todos os
// updates persistem `.eq('user_id', ctx.userId)` para defender contra
// IDOR cross-tenant (e.g. flipar `message.status` de outro tenant).
//
// Sempre retornamos 200 quando o payload é válido E autenticado, mesmo
// se o evento for unknown ou sem efeito — Evolution retransmite em
// qualquer não-2xx, o que gera duplicatas.

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
  // Caminho preferido pós-#130: slug nanoid em `evo_instance_v2`. O índice
  // UNIQUE em (evo_instance_v2) garante 0 ou 1 row.
  const v2 = await supabase
    .from("whatsapp_instances")
    .select("user_id, status")
    .eq("evo_instance_v2", instance)
    .maybeSingle();
  if (v2.data) {
    return { userId: v2.data.user_id, status: v2.data.status };
  }

  // Fallback para instâncias legadas ainda pareadas no Evolution com o
  // slug antigo `user_<8hex>`. Drop após restart cycle (migration 0022
  // marca `evo_instance` como DEPRECATED).
  const legacy = await supabase
    .from("whatsapp_instances")
    .select("user_id, status")
    .eq("evo_instance", instance)
    .maybeSingle();
  if (!legacy.data) return null;
  return { userId: legacy.data.user_id, status: legacy.data.status };
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
  ctx: { userId: string; status: string } | null,
) {
  if (event.type === "unknown") return;

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
      .eq("user_id", ctx.userId);
    return;
  }

  if (event.type === "message.status") {
    if (!ctx) return; // sem dono conhecido — não toca status de ninguém.
    // ⚠️ #130 fix: o `.eq('user_id', ctx.userId)` é o que impede um
    // atacante (com qualquer instance válida) de flipar status de mensagens
    // de outros tenants conhecendo só o `whatsapp_msg_id`.
    await supabase
      .from("lead_messages")
      .update({ status: event.status })
      .eq("whatsapp_msg_id", event.messageId)
      .eq("user_id", ctx.userId);
    return;
  }

  if (event.type === "message.upsert") {
    if (!ctx) return; // sem user → não conseguimos resolver lead
    if (event.fromMe) return; // outbound já gravamos no send.ts
    const lead = await resolveLeadForInbound(supabase, ctx.userId, event.from);
    if (!lead) {
      // Mensagem de número que não está nos leads do user — ignoramos no MVP.
      // Fase futura: criar lead automático ou inbox "outros números".
      //
      // #133: até então o drop acontecia em silêncio. Log estruturado pra
      // observabilidade (auditoria, alerta de número novo, debug de
      // normalização de phone). Não logamos `content` pra não vazar
      // mensagem do remetente em logs.
      console.warn(
        JSON.stringify({
          level: "warn",
          route: "POST /api/whatsapp/webhook",
          event: "inbound_dropped",
          reason: "no_matching_lead",
          remoteJid: event.from,
          instance: event.instance,
          userId: ctx.userId,
        }),
      );
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
      // #138b — detecção por PG error code (`23505` = unique_violation), não
      // por string match. `error.message` pode estar localizada ou ser
      // reescrita por um proxy, então `includes('duplicate')` era frágil.
      // Outros codes (ex.: `23502` not_null_violation) viram throw para que
      // a outer catch retorne 500 e o Evolution retransmita.
      const code = (insertErr as { code?: string }).code;
      if (code === "23505") {
        return;
      }
      throw new Error(
        `lead_messages insert failed (code=${code ?? "unknown"}): ${insertErr.message ?? ""}`,
      );
    }

    if (lead.stage === "new" || lead.stage === "contacted") {
      // Defense-in-depth: lead.id já é único, mas escopamos por user_id
      // pra alinhar com o pattern dos outros updates e proteger contra
      // qualquer cenário onde a resolução de lead retorne id alheio.
      await supabase
        .from("leads")
        .update({ stage: "in_conversation" })
        .eq("id", lead.id)
        .eq("user_id", ctx.userId);
    }
    return;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = pickSignature(request.headers);

  // HMAC primary path — quando o originador assina (proxy, futura versão do
  // Evolution, ou config customizada). Se inválido, rejeita imediatamente.
  if (signature) {
    if (!verifyHmac(rawBody, signature, env.EVOLUTION_WEBHOOK_SECRET ?? "")) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  try {
    const supabase = createServiceSupabase();

    // #130: SEMPRE resolvemos o `userId` via lookup ANTES de qualquer
    // processamento (inclusive eventos `unknown`). Caso contrário o
    // short-circuit anterior vazava "HMAC está configurado" — sinal útil
    // para atacantes que recebem 401 em assinatura inválida vs 200 em
    // payload qualquer.
    const instanceCandidate = extractInstanceFromRoot(payload);
    const ctx = instanceCandidate
      ? await lookupUserByInstance(supabase, instanceCandidate)
      : null;

    if (!signature && !ctx) {
      // Sem HMAC e sem instância conhecida — sem caminho de auth válido.
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const event = parseWebhookPayload(payload);
    if (event.type === "unknown") {
      // Aceita mas não processa — evita retransmissão. Importante: só
      // chegamos aqui após HMAC válido OU lookup do `instance` ter
      // sucedido, então o 200 não vaza configuração de HMAC.
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    await handleEvent(supabase, event, ctx);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "POST /api/whatsapp/webhook",
        message:
          error instanceof Error ? error.message : "webhook handler failed",
      }),
    );
    // Retornamos 500 pra Evolution retransmitir.
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
