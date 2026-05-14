import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { generateMessage } from "@/lib/ai/anthropic";
import { apiErrorResponse } from "@/lib/api/errors";
import { publicEnv } from "@/lib/env-public";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateMessageSchema } from "@/lib/validators/ai";

const RATE_LIMIT_MS = 1_000;
// TTL maior que a janela de throttle evita vazar memória em runtime longo:
// entradas que já passaram do limite há muito tempo são purgadas no próximo
// acesso. Em multi-instance (cold-start) cada processo tem seu Map; isso é
// best-effort por desenho. V2: migrate to Postgres `ai_usage_counters` table —
// see #132 follow-up.
const RATE_LIMIT_TTL_MS = RATE_LIMIT_MS * 10;
const lastRequestByUser = new Map<
  string,
  { ts: number; expiresAt: number }
>();

// Literal string (não `.join(",")`) para que o typegen do
// `@supabase/postgrest-js` consiga inferir o shape retornado pelo
// `.select(...)` — eliminando o cast `as unknown as LeadForMessage`
// que existia enquanto a select-list era construída em runtime.
// Lista deve permanecer 1:1 com `LeadForMessage` em `lib/ai/anthropic.ts`.
const LEAD_FOR_MESSAGE_SELECT =
  "name, source, category, city, state, country, phone, email, website, instagram_handle, whatsapp, has_website, rating, reviews_count, followers_count, stage, score, notes";

function validationIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function purgeStaleRateLimitEntries(now: number) {
  for (const [userId, entry] of lastRequestByUser) {
    if (entry.ts < now - RATE_LIMIT_TTL_MS) {
      lastRequestByUser.delete(userId);
    }
  }
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  purgeStaleRateLimitEntries(now);
  const last = lastRequestByUser.get(userId);
  if (last !== undefined && now - last.ts < RATE_LIMIT_MS) {
    return false;
  }
  lastRequestByUser.set(userId, {
    ts: now,
    expiresAt: now + RATE_LIMIT_TTL_MS,
  });
  return true;
}

// Helpers test-only — não usar em produção. Permitem inspecionar o Map e
// resetar o estado entre testes sem expor a referência interna.
export function _rateLimitMapSize(): number {
  return lastRequestByUser.size;
}

export function _resetRateLimit(): void {
  lastRequestByUser.clear();
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      {
        error: "Body inválido",
        issues: [{ path: "", message: "JSON inválido" }],
      },
      { status: 400 },
    );
  }

  const parsed = generateMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body inválido", issues: validationIssues(parsed.error) },
      { status: 400 },
    );
  }

  if (!checkRateLimit(user.id)) {
    // Body preserva a mensagem PT-BR pra UX (o componente
    // `components/ai/message-generator.tsx` exibe `error` direto em toast)
    // e segue a convenção de /api/whatsapp/send. `code` dá a máquina um
    // identificador estável. Header Retry-After: 1 padroniza com
    // /api/whatsapp/send. V2: migrate to Postgres `ai_usage_counters`
    // table — see #132 follow-up.
    return NextResponse.json(
      {
        error: "Muitas tentativas. Aguarde um segundo.",
        code: "rate_limited",
      },
      { status: 429, headers: { "Retry-After": "1" } },
    );
  }

  try {
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(LEAD_FOR_MESSAGE_SELECT)
      .eq("id", parsed.data.leadId)
      .maybeSingle();

    if (leadError) {
      throw new Error(`Falha ao carregar lead: ${leadError.message}`);
    }
    if (!lead) {
      return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
    }

    // Fetch site URL pra incluir na mensagem (regra obrigatória do
    // SYSTEM_PROMPT quando site_preview_url presente no payload). RLS
    // garante que só o owner do lead vê o site.
    const { data: siteRow } = await supabase
      .from("lead_sites")
      .select("slug, status")
      .eq("lead_id", parsed.data.leadId)
      .in("status", ["published", "sent"])
      .maybeSingle();
    const siteUrl = siteRow?.slug
      ? `${publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/sites/${siteRow.slug}`
      : null;

    const content = await generateMessage(lead, {
      channel: parsed.data.channel,
      tone: parsed.data.tone,
      goal: parsed.data.goal,
      siteUrl,
    });

    // Rascunho de IA: nasce com `ai_generated=true` e `status='queued'`.
    // Não conta como conversa real até passar pelo /api/whatsapp/send (que
    // promove status='sent' e preenche whatsapp_msg_id). A inbox /messages
    // filtra por (direction='inbound' OR whatsapp_msg_id IS NOT NULL).
    const { data: message, error: messageError } = await supabase
      .from("lead_messages")
      .insert({
        lead_id: parsed.data.leadId,
        user_id: user.id,
        channel: parsed.data.channel,
        tone: parsed.data.tone,
        content,
        ai_generated: true,
        status: "queued",
      })
      .select("id, content")
      .single();

    if (messageError || !message) {
      throw new Error(
        `Falha ao persistir mensagem: ${messageError?.message ?? "desconhecido"}`,
      );
    }

    return NextResponse.json({
      content: message.content,
      messageId: message.id,
    });
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "POST /api/ai/generate-message", userId: user.id },
      "Falha ao gerar mensagem. Tente novamente.",
    );
  }
}
