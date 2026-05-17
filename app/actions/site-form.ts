"use server";

/**
 * Server Action `submitSiteForm` (Phase 7 — issues #161 + #223).
 *
 * **#161 (MVP, mantido):** valida payload via `SiteFormSchema` (Zod).
 *
 * **#223 estende** com:
 *   - **Persistência** em `lead_form_submissions` via service-role
 *     (rota pública, sem `auth.uid()`), gated por env flag
 *     `NEXT_PUBLIC_SITE_FORMS_ENABLED === '1'` — deploy gradual.
 *   - **Rate limit por IP**: 3 submissions / hora → bloqueia com
 *     mensagem PT-BR (`{ success: false, error: 'Muitas tentativas...' }`).
 *     IP via `x-forwarded-for` → fallback `x-real-ip` → null.
 *   - **Honeypot (`extras.honeypot`)**: campo `<input name="website">`
 *     escondido visualmente; bots preenchem, humanos não. Se non-empty
 *     → silent success + `console.warn` (sem PII).
 *   - **Min-time gate (`extras.renderedAt`)**: `Date.now() - renderedAt
 *     < 2000ms` → silent success + warn. Bots costumam submeter o form
 *     em < 100ms.
 *   - **LGPD audit per submission**: `consent_text` (copy renderizado),
 *     `consent_ip` (inet), `consent_user_agent`, `consent_timestamp`.
 *     Decisão PO: audit por submission > audit global (defensável
 *     juridicamente).
 *
 * **Defesa em profundidade:**
 *   - `siteId` é tratado como `lead_site_id` (UUID); validamos via
 *     fetch (RLS-bypass com service-role) — se a row não existir,
 *     rejeita SEM revelar.
 *   - Honeypot/min-time retornam `{ success: true }` propositalmente —
 *     não dar feedback ao bot que detectamos o trip.
 *   - `console.warn` é PII-safe: NÃO loga payload (name/email/phone).
 *     Loga apenas `lead_site_id` + reason.
 *
 * **Mock factory de tests:** `tests/__mocks__/supabase.ts` cobre o
 * pattern básico. Para este action usamos mock inline (suporte a
 * `.gte()` não está no factory).
 */

import { headers } from "next/headers";

import { publicEnv } from "@/lib/env-public";
import { SiteFormSchema, type SiteFormInput } from "@/lib/sites/site-form.schema";
import { createServiceSupabase } from "@/lib/supabase/service";

/** Limite anti-bot: minimum time elapsed entre mount e submit (ms). */
const MIN_TIME_MS = 2000;

/** Rate limit: máximo de submissions por IP na janela de 1h. */
const RATE_LIMIT_PER_HOUR = 3;

/**
 * Copy LGPD canônico persistido por submission. Idêntico ao texto
 * renderizado em `<HomeContactFormQuick>` — single source of truth.
 *
 * Mudanças neste texto **DEVEM** acompanhar mudança visual no form;
 * audit jurídico exige fidelidade entre o que o usuário viu e o que
 * foi persistido.
 */
const LGPD_CONSENT_TEXT =
  "Concordo com a Política de Privacidade e autorizo o uso dos meus dados (nome, e-mail, telefone) para contato comercial referente ao meu interesse em veículos. Posso revogar este consentimento a qualquer momento.";

export interface SubmitSiteFormExtras {
  /**
   * Valor do campo `<input name="website">` (honeypot — escondido via
   * CSS). Bots preenchem; humanos deixam vazio. Default `""` quando
   * caller legacy (sem extras) chama.
   */
  honeypot?: string;
  /**
   * `Date.now()` capturado no `useEffect` de mount do form (Client).
   * Server compara `Date.now() - renderedAt` com `MIN_TIME_MS`. Default
   * `undefined` → gate desligado (callers legacy).
   */
  renderedAt?: number;
}

export type SubmitSiteFormResult =
  | { success: true }
  | { success: false; error: string };

export async function submitSiteForm(
  siteId: string,
  payload: SiteFormInput,
  extras: SubmitSiteFormExtras = {},
): Promise<SubmitSiteFormResult> {
  // -------------------------------------------------------------------------
  // Step 1 — Validação síncrona de inputs (não toca DB)
  // -------------------------------------------------------------------------
  if (typeof siteId !== "string" || siteId.length === 0) {
    return { success: false, error: "siteId inválido" };
  }

  const parsed = SiteFormSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Payload inválido",
    };
  }

  // -------------------------------------------------------------------------
  // Step 2 — Anti-bot: honeypot ANTES de validation (já passou) e min-time
  // gate. Resultados silenciosos pra não dar feedback ao bot.
  // -------------------------------------------------------------------------
  if (typeof extras.honeypot === "string" && extras.honeypot.length > 0) {
    console.warn("submitSiteForm:honeypot_tripped", {
      lead_site_id: siteId,
    });
    return { success: true };
  }

  // Wave B2 (R-03): defesa em profundidade — quando renderedAt
  // ausente OU não-numérico, tratamos como bot. Antes o gate só
  // disparava quando renderedAt era number, deixando bots scripted que
  // submetessem antes do mount-effect do client passarem batido.
  if (typeof extras.renderedAt !== "number") {
    console.warn("submitSiteForm:min_time_gate_missing", {
      lead_site_id: siteId,
    });
    return { success: true };
  }
  const elapsed = Date.now() - extras.renderedAt;
  if (elapsed < MIN_TIME_MS) {
    console.warn("submitSiteForm:min_time_gate", {
      lead_site_id: siteId,
      elapsed_ms: elapsed,
    });
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Step 3 — Feature flag gate. Quando OFF, mantém comportamento legacy
  // (#161 stub) — valida e retorna sucesso sem persistir.
  // -------------------------------------------------------------------------
  if (publicEnv.NEXT_PUBLIC_SITE_FORMS_ENABLED !== "1") {
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Step 4 — Resolve IP + UA via headers do request (next/headers).
  // -------------------------------------------------------------------------
  const hdrs = await headers();
  const ip = resolveClientIp(hdrs);
  const userAgent = hdrs.get("user-agent") ?? null;

  // -------------------------------------------------------------------------
  // Step 5 — Service-role client (rota pública, sem auth.uid()).
  // -------------------------------------------------------------------------
  const supabase = createServiceSupabase();

  // -------------------------------------------------------------------------
  // Step 6 — Resolve `user_id` via lookup em `lead_sites` (siteId é a PK).
  // RLS bypassed pelo service-role; isolamento é responsabilidade dessa
  // query (eq id) + persistência subsequente.
  // -------------------------------------------------------------------------
  const siteLookup = await supabase
    .from("lead_sites")
    .select("id, user_id")
    .eq("id", siteId)
    .maybeSingle();

  const siteRow = siteLookup.data as
    | { id: string; user_id: string }
    | null
    | undefined;

  if (siteLookup.error || !siteRow) {
    return { success: false, error: "Site não encontrado" };
  }

  // -------------------------------------------------------------------------
  // Step 7 — Rate limit por IP. Pula quando IP é null (não temos como
  // associar — abre porta pra abuse, mas Vercel/proxy sempre injeta o header
  // em prod; localhost dev fica isento o que é OK).
  // -------------------------------------------------------------------------
  if (ip) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const rateQuery = (await supabase
      .from("lead_form_submissions")
      .select("*", { count: "exact", head: true })
      .eq("consent_ip", ip)
      .gte("created_at", oneHourAgo)) as unknown as {
      count: number | null;
      error: { message: string } | null;
    };

    if (rateQuery.error) {
      // Não bloqueia em erro de rate-limit query — fail-open pra não derrubar
      // submissions legítimas. Log estruturado pra observabilidade.
      console.warn("submitSiteForm:rate_limit_query_error", {
        lead_site_id: siteId,
        error_message: rateQuery.error.message,
      });
    } else if ((rateQuery.count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return {
        success: false,
        error: "Muitas tentativas. Tente novamente em 1 hora.",
      };
    }
  }

  // -------------------------------------------------------------------------
  // Step 8 — Persiste em lead_form_submissions com LGPD audit fields.
  // -------------------------------------------------------------------------
  const insertResult = (await supabase.from("lead_form_submissions").insert({
    user_id: siteRow.user_id,
    lead_site_id: siteRow.id,
    name: parsed.data.name,
    phone: parsed.data.phone,
    email: parsed.data.email,
    model: parsed.data.model,
    message: parsed.data.message ?? null,
    consent_text: LGPD_CONSENT_TEXT,
    consent_ip: ip,
    consent_user_agent: userAgent,
    consent_timestamp: new Date().toISOString(),
  })) as unknown as { error: { message: string } | null };

  if (insertResult.error) {
    // Não vazar mensagem de banco direto ao cliente.
    console.warn("submitSiteForm:insert_error", {
      lead_site_id: siteId,
      error_message: insertResult.error.message,
    });
    return { success: false, error: "Erro ao registrar mensagem. Tente novamente." };
  }

  return { success: true };
}

/**
 * Resolve IP do cliente via headers padrão de proxy/CDN.
 * Ordem: `x-forwarded-for` (split first) → `x-real-ip` → `null`.
 */
function resolveClientIp(hdrs: Headers): string | null {
  const xff = hdrs.get("x-forwarded-for");
  if (xff && xff.length > 0) {
    const first = xff.split(",")[0]?.trim();
    if (first && first.length > 0) {
      return first;
    }
  }
  const xri = hdrs.get("x-real-ip");
  if (xri && xri.length > 0) {
    return xri.trim();
  }
  return null;
}
