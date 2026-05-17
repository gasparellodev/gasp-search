"use server";

/**
 * Server Action `generateFAQ(siteId)` — issue #G3, Frente 04 GEO/AI.
 *
 * Gera 8 FAQs PT-BR para um site de concessionária usando Anthropic
 * Sonnet 4.6 com tool use forçado (`emit_faqs`).
 *
 * **Sem persistência (V1).** O Server Action retorna o array validado —
 * o caller decide o que fazer (exibir na UI, copiar para o clipboard,
 * etc.). Persistência requer um follow-up que adicione uma coluna
 * `lead_sites.faq_generated JSONB NULL` ou um campo `faq` em
 * `SiteVariablesV2`. Essa decisão de schema está fora do escopo deste PR.
 *
 * **Auto-trigger em `signLeadSite`** também é out-of-scope: requer
 * persistência primeiro.
 *
 * **Auth:** verificação via `createServerSupabase()` (lê `auth.uid()`).
 * A query ao `lead_sites` respeita RLS — propriedade é enforçada pelo DB.
 */

import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import { readSiteVariablesSafe } from "@/lib/sites/migrate-variables";
import {
  generateFaqContent,
  FaqGenerationError,
} from "@/lib/sites/generate-faq";
import type { FaqEntry } from "@/lib/sites/faq-template";

// ---------------------------------------------------------------------------
// Result type — discriminated union para UI consumir via switch
// ---------------------------------------------------------------------------

export type GenerateFAQResult =
  | { ok: true; faqs: FaqEntry[] }
  | { ok: false; code: string; message: string };

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

/**
 * Gera 8 FAQs PT-BR para o site identificado por `siteId`.
 *
 * Fluxo:
 *  1. Verifica autenticação via `auth.getUser()`.
 *  2. Carrega `lead_sites` por ID — RLS enforça propriedade via `user_id`.
 *  3. Lê e valida `variables` via `readSiteVariablesSafe`.
 *  4. Extrai `business_name`, `address`, `cars[].brand` (deduplicated).
 *  5. Chama `generateFaqContent` (Anthropic, tool use forçado, Zod-validado).
 *  6. Retorna `{ ok: true, faqs }` ou `{ ok: false, code, message }`.
 *
 * **Observabilidade:** sem logs de PII. `siteId` (UUID) é safe para log.
 */
export async function generateFAQ(
  siteId: string,
): Promise<GenerateFAQResult> {
  // 1. Auth
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: "unauthenticated",
      message: "Usuário não autenticado.",
    };
  }

  // 2. Carregar site (RLS via user_id enforça ownership)
  const { data: site, error } = await supabase
    .from("lead_sites")
    .select("variables")
    .eq("id", siteId)
    .single();

  if (error ?? !site) {
    return {
      ok: false,
      code: "not_found",
      message: "Site não encontrado ou sem permissão de acesso.",
    };
  }

  // 3. Validar variables
  const parsed = readSiteVariablesSafe(site.variables);
  if (!parsed.success) {
    return {
      ok: false,
      code: "bad_variables",
      message: "Variáveis do site estão em formato inválido.",
    };
  }

  const v = parsed.data;

  // 4. Extrair input para o gerador
  const brands = Array.from(
    new Set(
      (v.cars ?? [])
        .map((c) => c.brand)
        .filter((b): b is string => typeof b === "string" && b.trim().length > 0),
    ),
  );

  const city = v.address?.city ?? null;
  const state = v.address?.state ?? null;

  // 5. Chamar gerador
  try {
    const faqs = await generateFaqContent({
      business_name: v.business_name,
      brands,
      city,
      state,
      // V1: SiteVariablesV2 não tem campo de garantia. Passar null.
      // Follow-up: adicionar quando schema ganhar warranty_summary.
      warranty_summary: null,
    });

    return { ok: true, faqs };
  } catch (err) {
    if (err instanceof FaqGenerationError) {
      return {
        ok: false,
        code: err.code,
        message: err.message,
      };
    }
    return {
      ok: false,
      code: "unknown",
      message: `Erro inesperado: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
