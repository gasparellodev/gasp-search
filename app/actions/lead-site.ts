"use server";

/**
 * Server Action `generateLeadSite(leadId)` — culminação do M1 do Phase 7
 * Site Generator (issue #159).
 *
 * **Fonte canônica:** §10 do spec mestre + body da issue #159 (refinada
 * em revalidação PO 2026-05-08, todas as 12 lacunas endereçadas).
 *
 * Orquestra o pipeline completo:
 *   1. Auth (Supabase) — sem usuário → `error: 'auth'`.
 *   2. Rate limit (5/60s) via tabela `generation_throttle` (#159 AC4).
 *   3. Insert da tentativa em `generation_throttle` ANTES do trabalho pesado.
 *   4. Lookup do lead (RLS isola; null → `LeadNotFoundError` → `error: 'not_found'`).
 *   5. Brand assets pipeline (#156, garantia BLOQUEANTE de não lançar — mas
 *      defesa em profundidade com try/catch + fallback inline).
 *   6. Slug:
 *      - Primeira geração: `generateUniqueSlug` (#155).
 *      - Regen: preserva slug existente (WhatsApp link já enviado não quebra).
 *      - `SlugCollisionError` → `error: 'db_error'` (sem persistir draft).
 *   7. Copy IA (#158) com retry 1x exponencial em `GenerationError.retryable`;
 *      falha persistente → status='draft' + `generation_error` JSON
 *      `{ code, message, timestamp }` → `error: 'ai_error'`.
 *   8. Sanitize URLs (`safeUrl` em todos os campos de imagem) — defesa
 *      contra `javascript:`, `data:`, `file:`, `vbscript:` que vazem
 *      do pipeline de brand assets.
 *   9. Merge → SiteVariables.parse(). Falha → status='draft' +
 *      `generation_error` (Zod issues serializadas) → `error: 'validation'`.
 *  10. Upsert `lead_sites` via service_role (status='published',
 *      `onConflict: 'user_id,lead_id'`). Erro de DB → `error: 'db_error'`.
 *  11. Invalidação de cache: `updateTag(\`site:\${slug}\`)` (Next 16 — equivalente
 *      a `revalidateTag` mas com semântica read-your-own-writes específica
 *      pra Server Actions) + `revalidatePath(\`/leads/\${leadId}\`)` pra refresh
 *      do card LeadSiteCard (#167).
 *
 * **Observabilidade (#159 AC9):** logs estruturados em ≥4 steps via
 * `console.info(..., { action, step, leadId, userId, durationMs, ok })`.
 * NUNCA logar `business_name`, `email` ou texto da copy (PII). Erros
 * logados via `console.error` com `error.name + error.message` apenas
 * (sem `cause`/stack).
 */

import "server-only";

import { revalidatePath, updateTag } from "next/cache";
import { ZodError } from "zod";

import { env } from "@/lib/env";
import { sendWhatsAppMessage } from "@/lib/evolution/send";
import { generateCopy } from "@/lib/sites/generate-copy";
import { extractBrandAssets } from "@/lib/sites/brand-assets";
import { FALLBACK_IMAGE_URL, mergeSiteVariables } from "@/lib/sites/merge";
import {
  GenerationError,
  LeadNotFoundError,
  RateLimitError,
  SiteVariablesValidationError,
  SlugCollisionError,
} from "@/lib/sites/errors";
import { safeUrl } from "@/lib/sites/sanitize";
import { generateUniqueSlug } from "@/lib/sites/slug";
import type { AssetSources } from "@/lib/sites/brand-assets.types";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import type { Database } from "@/types/database";
import { SiteVariablesV2 } from "@/types/lead-site";
import {
  checkDailyInstanceLimit,
  DAILY_INSTANCE_LIMIT,
} from "@/lib/whatsapp/daily-limit";
import { renderTemplate } from "@/lib/whatsapp/render-template";
import { SITE_PREVIEW_TEMPLATE } from "@/lib/whatsapp/templates";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/**
 * Retorno discriminated union — UI consome via exhaustive switch.
 *
 * Erros possíveis:
 *  - `auth`        — usuário não autenticado (Supabase `getUser` null).
 *  - `not_found`   — leadId não existe ou não pertence ao usuário (RLS).
 *  - `rate_limit`  — 5+ chamadas em 60s (DB-backed via generation_throttle).
 *  - `ai_error`    — `generateCopy` falhou (após retry se retryable). Site
 *                    persistido como `draft` com `generation_error`.
 *  - `validation`  — `SiteVariables.parse` falhou após merge. Site persistido
 *                    como `draft` com `generation_error`.
 *  - `db_error`    — falha de infra (slug exhaustion, upsert race, RLS bypass
 *                    inesperado). Site **NÃO** é persistido — não é falha
 *                    de IA, é problema de banco que requer triagem humana.
 */
export type GenerateLeadSiteResult =
  | { ok: true; slug: string }
  | {
      ok: false;
      error:
        | "auth"
        | "not_found"
        | "rate_limit"
        | "ai_error"
        | "validation"
        | "db_error";
      message: string;
    };

/**
 * Retorno da `updateLeadSiteVariables` (issue #168).
 *
 * Erros possíveis:
 *  - `auth`            — usuário não autenticado.
 *  - `not_found`       — leadSiteId não existe ou não pertence ao usuário (RLS).
 *  - `invalid_status`  — status do site não é 'published' ou 'sent'
 *                        (defesa em profundidade, UI já bloqueia).
 *  - `validation`      — patch falha em `SiteVariables.partial()` ou
 *                        merge final falha em `SiteVariables.parse`.
 *  - `db_error`        — falha de infra na escrita.
 */
export type UpdateLeadSiteVariablesResult =
  | { ok: true; slug: string }
  | {
      ok: false;
      error:
        | "auth"
        | "not_found"
        | "invalid_status"
        | "validation"
        | "db_error";
      message: string;
    };

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 5;
const AI_RETRY_BACKOFF_MS = 2_000;

/**
 * Fallback de URL aplicado quando `safeUrl` rejeita um valor (scheme
 * malicioso). `https:` garantido — passa em `SiteVariables.parse()`.
 *
 * Em produção, esse caminho idealmente não é atingido (#156 já garante
 * URLs válidas). Mas é o último guard em defesa em profundidade.
 */
// `FALLBACK_IMAGE_URL` é re-exportado de `lib/sites/merge.ts` pra compartilhar
// entre o orquestrador e a lógica de merge sem duplicação.
const FALLBACK_LOGO_URL = "https://placehold.co/256x256/0c0c0c/ffffff.png";

/**
 * Fallback de `AssetSources` usado quando `extractBrandAssets` lança
 * (cenário catastrófico — não deveria acontecer pela garantia BLOQUEANTE
 * de #156, mas defesa em profundidade).
 *
 * Todos os campos são URLs `https:` válidas → passam em `SiteVariables.parse`.
 */
function buildCatastrophicAssetsFallback(): AssetSources {
  return {
    logo_url: FALLBACK_LOGO_URL,
    primary_color: "#000000",
    text_on_primary: "#FFFFFF",
    hero_image_url: FALLBACK_IMAGE_URL,
    about_image_url: FALLBACK_IMAGE_URL,
    contact_hero_image_url: FALLBACK_IMAGE_URL,
    car_placeholder_urls: Array.from(
      { length: 6 },
      () => FALLBACK_IMAGE_URL,
    ),
  };
}

// ---------------------------------------------------------------------------
// Logger estruturado (PII-safe)
// ---------------------------------------------------------------------------

type LogStep =
  | "rate_limit"
  | "lead_lookup"
  | "brand_assets"
  | "slug"
  | "copy"
  | "validate"
  | "persist"
  | "complete";

function logStep(
  step: LogStep,
  payload: {
    leadId: string;
    userId: string | null;
    durationMs?: number;
    ok: boolean;
    extra?: Record<string, unknown>;
  },
): void {
  // `console.info` com 2º arg objeto → Vercel preserva como structured log.
  // PII-safe por construção: não passamos lead.name, email, ou texto da copy.
  console.info("generateLeadSite", {
    action: "generateLeadSite",
    step,
    leadId: payload.leadId,
    userId: payload.userId,
    ...(payload.durationMs !== undefined && { durationMs: payload.durationMs }),
    ok: payload.ok,
    ...payload.extra,
  });
}

function logError(
  step: LogStep,
  payload: {
    leadId: string;
    userId: string | null;
    error: unknown;
    issues?: string;
  },
): void {
  // PII-safe: `error.name + error.message` — sem `cause` (pode conter dado
  // adversarial) e sem stack trace. `issues` é opt-in — só path+code (sem
  // valores) já serializado pelo caller, ver step `validate`.
  const e = payload.error;
  const errorName = e instanceof Error ? e.name : typeof e;
  const errorMessage = e instanceof Error ? e.message : String(e);
  console.error("generateLeadSite", {
    action: "generateLeadSite",
    step,
    leadId: payload.leadId,
    userId: payload.userId,
    ok: false,
    errorName,
    errorMessage,
    ...(payload.issues ? { issues: payload.issues } : {}),
  });
}

// ---------------------------------------------------------------------------
// Helpers de domínio
// ---------------------------------------------------------------------------

async function checkRateLimit(
  service: ReturnType<typeof createServiceSupabase>,
  userId: string,
): Promise<void> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await service
    .from("generation_throttle")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("attempted_at", since);

  if (error) {
    // Falha no count é tratada como rate-limit ok (fail-open) pra não bloquear
    // o user em caso de DB hiccup. Log no caller.
    return;
  }

  const used = count ?? 0;
  if (used >= RATE_LIMIT_MAX_PER_WINDOW) {
    throw new RateLimitError(60);
  }
}

async function recordThrottleAttempt(
  service: ReturnType<typeof createServiceSupabase>,
  userId: string,
): Promise<void> {
  // Best-effort: insert antes do trabalho pesado. Mesmo que upstream falhe,
  // a tentativa fica registrada — defesa contra burst exploit.
  await service.from("generation_throttle").insert({ user_id: userId });
}

async function fetchLead(
  server: Awaited<ReturnType<typeof createServerSupabase>>,
  leadId: string,
  userId: string,
): Promise<Lead> {
  const { data, error } = await server
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new LeadNotFoundError(leadId);
  }
  return data as Lead;
}

async function fetchExistingSite(
  server: Awaited<ReturnType<typeof createServerSupabase>>,
  leadId: string,
  userId: string,
): Promise<{ slug: string; status: string } | null> {
  const { data } = await server
    .from("lead_sites")
    .select("slug,status")
    .eq("user_id", userId)
    .eq("lead_id", leadId)
    .maybeSingle();
  return (data as { slug: string; status: string } | null) ?? null;
}

async function safeBrandAssets(lead: Lead): Promise<{
  assets: AssetSources;
  fallback: boolean;
}> {
  try {
    const assets = await extractBrandAssets(lead);
    return { assets, fallback: false };
  } catch {
    // #156 garante BLOQUEANTE não-lançar; este catch é defesa em profundidade.
    return { assets: buildCatastrophicAssetsFallback(), fallback: true };
  }
}

/**
 * Aplica `safeUrl` em todos os campos de URL de `AssetSources`. Quando
 * uma URL é rejeitada, substitui por fallback `https:` válido.
 *
 * Defesa em profundidade contra scheme injection (`javascript:`, `data:`,
 * `file:`, `vbscript:`) que possa vazar do pipeline de brand assets.
 */
function sanitizeAssetUrls(assets: AssetSources): AssetSources {
  return {
    ...assets,
    logo_url: safeUrl(assets.logo_url) ?? FALLBACK_LOGO_URL,
    hero_image_url: safeUrl(assets.hero_image_url) ?? FALLBACK_IMAGE_URL,
    about_image_url: safeUrl(assets.about_image_url) ?? FALLBACK_IMAGE_URL,
    contact_hero_image_url:
      safeUrl(assets.contact_hero_image_url) ?? FALLBACK_IMAGE_URL,
    car_placeholder_urls: assets.car_placeholder_urls.map(
      (u) => safeUrl(u) ?? FALLBACK_IMAGE_URL,
    ),
  };
}

/**
 * Retry exponencial pra `generateCopy`. 1 retry total: tenta, falha
 * retryable, espera 2s, tenta de novo. Falha não-retryable → propaga.
 */
async function generateCopyWithRetry(
  input: Parameters<typeof generateCopy>[0],
): Promise<Awaited<ReturnType<typeof generateCopy>>> {
  try {
    return await generateCopy(input);
  } catch (err) {
    if (err instanceof GenerationError && err.retryable) {
      await new Promise((r) => setTimeout(r, AI_RETRY_BACKOFF_MS));
      return generateCopy(input);
    }
    throw err;
  }
}

/**
 * Serializa um payload de erro pra coluna `lead_sites.generation_error`
 * (text). Estritamente `{ code, message, timestamp }` — sem `cause`/stack
 * pra evitar PII em log persistido.
 */
function serializeGenerationError(
  code: string,
  message: string,
): string {
  const payload = {
    code,
    message,
    timestamp: new Date().toISOString(),
  };
  // Defesa contra payload absurdo: cap em 4KB.
  const json = JSON.stringify(payload);
  return json.length > 4_000 ? json.slice(0, 4_000) : json;
}

async function persistDraftWithError(
  service: ReturnType<typeof createServiceSupabase>,
  args: {
    userId: string;
    leadId: string;
    slug: string;
    code: string;
    message: string;
  },
): Promise<void> {
  const generationError = serializeGenerationError(args.code, args.message);
  await service
    .from("lead_sites")
    .upsert(
      {
        user_id: args.userId,
        lead_id: args.leadId,
        slug: args.slug,
        status: "draft" as const,
        variables: {},
        generation_error: generationError,
      },
      { onConflict: "user_id,lead_id" },
    );
}

// ---------------------------------------------------------------------------
// Server Action principal
// ---------------------------------------------------------------------------

export async function generateLeadSite(
  leadId: string,
): Promise<GenerateLeadSiteResult> {
  const start = Date.now();

  // Step 1: Auth
  const server = await createServerSupabase();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "auth",
      message: "Você precisa estar autenticado para gerar um site.",
    };
  }
  const userId = user.id;

  const service = createServiceSupabase();

  // Step 2: Rate limit. `checkRateLimit` só lança `RateLimitError`
  // (qualquer erro de DB é tratado fail-open dentro do helper).
  try {
    await checkRateLimit(service, userId);
  } catch (err) {
    const rateErr = err as RateLimitError;
    logStep("rate_limit", { leadId, userId, ok: false });
    return {
      ok: false,
      error: "rate_limit",
      message: `Máximo ${RATE_LIMIT_MAX_PER_WINDOW} gerações por minuto. Tente em ${rateErr.retryAfterSec}s.`,
    };
  }
  logStep("rate_limit", { leadId, userId, ok: true });

  // Step 3: Record attempt (antes do trabalho pesado)
  await recordThrottleAttempt(service, userId);

  // Step 4: Fetch lead (RLS isola)
  let lead: Lead;
  try {
    lead = await fetchLead(server, leadId, userId);
  } catch (err) {
    if (err instanceof LeadNotFoundError) {
      logError("lead_lookup", { leadId, userId, error: err });
      return {
        ok: false,
        error: "not_found",
        message: "Lead não encontrado ou sem permissão de acesso.",
      };
    }
    throw err;
  }

  // Step 5: Brand assets pipeline (defesa em profundidade)
  const stepBrandStart = Date.now();
  const { assets: rawAssets, fallback: assetsFallback } = await safeBrandAssets(
    lead,
  );
  const assets = sanitizeAssetUrls(rawAssets);
  logStep("brand_assets", {
    leadId,
    userId,
    durationMs: Date.now() - stepBrandStart,
    ok: true,
    extra: { fallback: assetsFallback },
  });

  // Step 6: Slug — preserva existente em regen
  const stepSlugStart = Date.now();
  const existing = await fetchExistingSite(server, leadId, userId);
  let slug: string;
  if (existing) {
    slug = existing.slug;
  } else {
    try {
      slug = await generateUniqueSlug(lead.name, server);
    } catch (err) {
      if (err instanceof SlugCollisionError) {
        logError("slug", { leadId, userId, error: err });
        return {
          ok: false,
          error: "db_error",
          message:
            "Não foi possível alocar um slug único. Tente novamente em alguns segundos.",
        };
      }
      throw err;
    }
  }
  logStep("slug", {
    leadId,
    userId,
    durationMs: Date.now() - stepSlugStart,
    ok: true,
    extra: { regen: !!existing },
  });

  // Step 7: Copy IA com retry 1x exponencial
  const stepCopyStart = Date.now();
  let copy: Awaited<ReturnType<typeof generateCopy>>;
  try {
    copy = await generateCopyWithRetry({
      business_name: lead.name,
      business_type: "concessionaria",
      city: lead.city ?? undefined,
      state: lead.state ?? undefined,
      car_placeholder_count: assets.car_placeholder_urls.length,
      primary_color: assets.primary_color,
    });
  } catch (err) {
    logError("copy", { leadId, userId, error: err });
    if (err instanceof GenerationError) {
      await persistDraftWithError(service, {
        userId,
        leadId,
        slug,
        code: err.code,
        message: err.message,
      });
      return {
        ok: false,
        error: "ai_error",
        message:
          "Falha ao gerar a copy do site. Tente novamente em instantes.",
      };
    }
    throw err;
  }
  logStep("copy", {
    leadId,
    userId,
    durationMs: Date.now() - stepCopyStart,
    ok: true,
  });

  // Step 8 + 9: Merge + SiteVariablesV2.parse (defesa final)
  // `mergeSiteVariables` emite shape v2 desde issue #197 PR-C. Parser v2
  // garante schema canônico antes do persist no DB.
  const merged = mergeSiteVariables(lead, assets, copy);
  let variables: SiteVariablesV2;
  try {
    variables = SiteVariablesV2.parse(merged);
  } catch (cause) {
    const validationError = new SiteVariablesValidationError(cause);
    const issuesSerialized =
      cause instanceof ZodError
        ? cause.issues.map((i) => `${i.path.join(".")}: ${i.code}`).join("; ")
        : "unknown";
    logError("validate", {
      leadId,
      userId,
      error: validationError,
      issues: issuesSerialized,
    });
    await persistDraftWithError(service, {
      userId,
      leadId,
      slug,
      code: "schema_validation",
      message: issuesSerialized,
    });
    return {
      ok: false,
      error: "validation",
      message: "Variáveis inválidas — regere o site.",
    };
  }
  logStep("validate", { leadId, userId, ok: true });

  // Step 10: Persist (upsert via service_role, RLS bypass)
  const stepPersistStart = Date.now();
  const nowIso = new Date().toISOString();
  const { error: upsertError } = await service.from("lead_sites").upsert(
    {
      user_id: userId,
      lead_id: leadId,
      slug,
      status: "published" as const,
      variables: variables as unknown as Database["public"]["Tables"]["lead_sites"]["Insert"]["variables"],
      generation_error: null,
      generated_at: nowIso,
      published_at: nowIso,
    },
    { onConflict: "user_id,lead_id" },
  );

  if (upsertError) {
    logError("persist", { leadId, userId, error: upsertError });
    return {
      ok: false,
      error: "db_error",
      message: "Falha ao salvar o site no banco. Tente novamente.",
    };
  }

  logStep("persist", {
    leadId,
    userId,
    durationMs: Date.now() - stepPersistStart,
    ok: true,
  });

  // Step 11: Cache invalidation (Next 16 — updateTag, NÃO unstable_cacheTag).
  // `updateTag` é o equivalente de `revalidateTag` específico pra Server
  // Actions: invalida o cache populado por fetches com `cacheTag('site:<slug>')`
  // dentro de funções `'use cache'` (a route /sites/[slug] em #160).
  //
  // **#213**: `og:<slug>` cobre o opengraph-image dinâmico
  // (`app/sites/[slug]/opengraph-image.tsx`). Sem invalidar, o preview
  // social ficaria stale 1h (revalidate=3600) após publicação/edição.
  updateTag(`site:${slug}`);
  updateTag(`og:${slug}`);
  revalidatePath(`/leads/${leadId}`);

  logStep("complete", {
    leadId,
    userId,
    durationMs: Date.now() - start,
    ok: true,
  });

  return { ok: true, slug };
}

// ---------------------------------------------------------------------------
// updateLeadSiteVariables (#168) — edição manual das variáveis do site
// ---------------------------------------------------------------------------

/**
 * Lista de campos de `SiteVariablesV2` (top-level) que aceitam URL e devem
 * passar por `safeUrl()` antes do merge — defesa em profundidade contra
 * schemes maliciosos (`javascript:`, `data:`, `file:`, `vbscript:`).
 *
 * Issue #197 PR-C: campos visuais de v1 (`logo_url`, `hero_image_url`,
 * `about_image_url`, `contact_hero_image_url`) saíram do top-level e
 * agora vivem dentro de `brand_assets` — sanitizado em pass dedicado.
 *
 * `cars[].thumbnail_url`, `cars[].gallery_urls[]`, `cars[].photos[]`,
 * `home_categories[].image_url`, `emphasis.image_url`,
 * `recent_sales[].image_url` e `brand_assets.*` são tratados em
 * `sanitizePatchUrls` via passes específicos.
 */
const TOP_LEVEL_URL_FIELDS = [
  "instagram_url",
  "facebook_url",
  "youtube_url",
  "whatsapp_url",
] as const;

/**
 * Aplica `safeUrl()` em todos os campos de URL do patch v2. URLs com scheme
 * malicioso viram `null` (ou são removidas do patch para campos não-nullable
 * — nesse caso o validador final reprova a tentativa).
 *
 * Estratégia:
 *  - Para nullable URLs (social), `null` é aceito.
 *  - Para non-nullable URLs (`brand_assets.logo_url`, `brand_assets.hero_image_url`, ...),
 *    `safeUrl` retornar `null` faz a `SiteVariablesV2.parse` final falhar
 *    com error 'validation' — comportamento correto (rejeitar input
 *    sujo em vez de "limpar silenciosamente").
 *  - Para arrays (`photos`, `gallery_urls`, `car_placeholders`), aplica em
 *    cada item; itens inválidos viram `null` e o parse final reprova.
 */
function sanitizePatchUrls(
  patch: Partial<SiteVariablesV2>,
): Partial<SiteVariablesV2> {
  const out: Record<string, unknown> = { ...patch };

  for (const key of TOP_LEVEL_URL_FIELDS) {
    if (key in patch) {
      const value = patch[key];
      if (value === null || value === undefined) {
        out[key] = value;
      } else if (typeof value === "string") {
        out[key] = safeUrl(value);
      }
    }
  }

  // brand_assets.* (nested URLs)
  if (patch.brand_assets && typeof patch.brand_assets === "object") {
    const ba = patch.brand_assets;
    out.brand_assets = {
      ...ba,
      logo_url:
        typeof ba.logo_url === "string"
          ? (safeUrl(ba.logo_url) ?? "")
          : ba.logo_url,
      hero_image_url:
        typeof ba.hero_image_url === "string"
          ? (safeUrl(ba.hero_image_url) ?? "")
          : ba.hero_image_url,
      about_image_url:
        typeof ba.about_image_url === "string"
          ? (safeUrl(ba.about_image_url) ?? "")
          : ba.about_image_url,
      contact_image_url:
        typeof ba.contact_image_url === "string"
          ? (safeUrl(ba.contact_image_url) ?? "")
          : ba.contact_image_url,
      car_placeholders: Array.isArray(ba.car_placeholders)
        ? ba.car_placeholders.map((u) =>
            typeof u === "string" ? (safeUrl(u) ?? "") : "",
          )
        : ba.car_placeholders,
    };
  }

  // home_categories[].image_url
  if (Array.isArray(patch.home_categories)) {
    out.home_categories = patch.home_categories.map((c) => ({
      ...c,
      image_url:
        typeof c.image_url === "string" ? (safeUrl(c.image_url) ?? "") : "",
    }));
  }

  // emphasis.image_url
  if (patch.emphasis && typeof patch.emphasis === "object") {
    out.emphasis = {
      ...patch.emphasis,
      image_url:
        typeof patch.emphasis.image_url === "string"
          ? (safeUrl(patch.emphasis.image_url) ?? "")
          : "",
    };
  }

  // recent_sales[].image_url
  if (Array.isArray(patch.recent_sales)) {
    out.recent_sales = patch.recent_sales.map((s) => ({
      ...s,
      image_url:
        typeof s.image_url === "string" ? (safeUrl(s.image_url) ?? "") : "",
    }));
  }

  // cars[].thumbnail_url + cars[].gallery_urls[] + cars[].photos[]
  if (Array.isArray(patch.cars)) {
    out.cars = patch.cars.map((car) => ({
      ...car,
      thumbnail_url:
        typeof car.thumbnail_url === "string"
          ? (safeUrl(car.thumbnail_url) ?? "")
          : "",
      gallery_urls: Array.isArray(car.gallery_urls)
        ? car.gallery_urls.map((u) =>
            typeof u === "string" ? (safeUrl(u) ?? "") : "",
          )
        : car.gallery_urls,
      photos: Array.isArray(car.photos)
        ? car.photos.map((u) =>
            typeof u === "string" ? (safeUrl(u) ?? "") : "",
          )
        : car.photos,
    }));
  }

  return out as Partial<SiteVariablesV2>;
}

/**
 * Server Action `updateLeadSiteVariables(leadSiteId, patch)` — edição
 * manual (issue #168).
 *
 * Pipeline:
 *  1. Auth (Supabase) — sem usuário → `error: 'auth'`.
 *  2. Fetch lead_sites por id (via authenticated client, RLS isola).
 *  3. **Status guard** — `'published'` ou `'sent'` apenas. Caso
 *     contrário → `error: 'invalid_status'`.
 *  4. Validação parcial: `SiteVariables.partial().safeParse(patch)`.
 *     Falha → `error: 'validation'`.
 *  5. Sanitiza URLs do patch via `safeUrl` (defesa em profundidade).
 *  6. Merge `{ ...current, ...sanitized }`.
 *  7. Validação final completa: `SiteVariables.parse(merged)`. Falha
 *     → `error: 'validation'` (com mensagem PT-BR).
 *  8. Update via service_role (RLS bypass; usuário já passou no guard).
 *  9. Cache invalidation: `updateTag('site:{slug}')` + `revalidatePath`.
 *
 * **Anti-XSS:** URLs sanitizadas antes do merge. Validação dupla (parcial
 * + completa) garante que mesmo cores, slugs e textos sejam reaprovados
 * pelo schema antes de tocar o banco.
 *
 * **Cache:** `updateTag` invalida o cache da rota pública `/sites/[slug]`
 * para que F5 mostre o novo conteúdo.
 */
export async function updateLeadSiteVariables(
  leadSiteId: string,
  patch: Partial<SiteVariablesV2>,
): Promise<UpdateLeadSiteVariablesResult> {
  // Step 1: Auth
  const server = await createServerSupabase();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "auth",
      message: "Você precisa estar autenticado para editar o site.",
    };
  }
  const userId = user.id;

  // Step 2: Fetch lead_site (RLS filtra por user_id)
  const { data: existing, error: fetchError } = await server
    .from("lead_sites")
    .select("id, lead_id, slug, status, variables")
    .eq("id", leadSiteId)
    .maybeSingle();

  if (fetchError || !existing) {
    return {
      ok: false,
      error: "not_found",
      message: "Site não encontrado ou sem permissão de acesso.",
    };
  }

  // Step 3: Status guard (defesa em profundidade — UI já bloqueia)
  if (existing.status !== "published" && existing.status !== "sent") {
    return {
      ok: false,
      error: "invalid_status",
      message:
        "Apenas sites publicados ou enviados podem ser editados.",
    };
  }

  // Step 4: Validação parcial (rejeita campos com tipos errados antes
  // do merge — proteção contra payload adversarial). Issue #197 PR-C:
  // schema v2 (nested brand_assets, address, cars com v2 fields).
  const partialParse = SiteVariablesV2.partial().safeParse(patch);
  if (!partialParse.success) {
    return {
      ok: false,
      error: "validation",
      message: "Dados do formulário inválidos. Confira os campos.",
    };
  }

  // Step 5: Sanitiza URLs (defesa em profundidade)
  const sanitized = sanitizePatchUrls(partialParse.data);

  // Step 6: Merge com `variables` atual
  const current = (existing.variables ?? {}) as Record<string, unknown>;
  const merged: unknown = { ...current, ...sanitized };

  // Step 7: Validação final completa (v2 — issue #197 PR-C)
  let variables: SiteVariablesV2;
  try {
    variables = SiteVariablesV2.parse(merged);
  } catch (cause) {
    const issuesSerialized =
      cause instanceof ZodError
        ? cause.issues
            .map((i) => `${i.path.join(".")}: ${i.code}`)
            .join("; ")
        : "unknown";
    console.error("updateLeadSiteVariables.validate", {
      action: "updateLeadSiteVariables",
      step: "validate",
      leadSiteId,
      userId,
      issuesSerialized,
    });
    return {
      ok: false,
      error: "validation",
      message:
        "Os dados resultantes não passaram na validação. Confira os campos.",
    };
  }

  // Step 8: Update via service_role
  const service = createServiceSupabase();
  const nowIso = new Date().toISOString();
  const { error: updateError } = await service
    .from("lead_sites")
    .update({
      variables:
        variables as unknown as Database["public"]["Tables"]["lead_sites"]["Update"]["variables"],
      updated_at: nowIso,
    })
    .eq("id", leadSiteId);

  if (updateError) {
    console.error("updateLeadSiteVariables.persist", {
      action: "updateLeadSiteVariables",
      step: "persist",
      leadSiteId,
      userId,
      errorName: updateError.name ?? "unknown",
      errorMessage: updateError.message ?? "",
    });
    return {
      ok: false,
      error: "db_error",
      message: "Falha ao salvar o site no banco. Tente novamente.",
    };
  }

  // Step 9: Cache invalidation
  // #213: também invalida `og:<slug>` (opengraph-image dinâmica).
  updateTag(`site:${existing.slug}`);
  updateTag(`og:${existing.slug}`);
  if (existing.lead_id) {
    revalidatePath(`/leads/${existing.lead_id}`);
  }

  return { ok: true, slug: existing.slug };
}

// ---------------------------------------------------------------------------
// archiveLeadSite (#169) — arquivar site publicado/enviado
// ---------------------------------------------------------------------------

/**
 * Retorno discriminado de `archiveLeadSite` e `restoreLeadSite` (#169).
 *
 * Erros:
 *  - `auth`           — usuário não autenticado.
 *  - `not_found`      — leadSiteId não existe ou não pertence ao usuário (RLS).
 *  - `invalid_status` — status do site não permite a transição (defesa em
 *                       profundidade — UI já bloqueia).
 *  - `db_error`       — falha de infra na escrita.
 */
export type LeadSiteStatusActionResult =
  | { ok: true }
  | {
      ok: false;
      error: "auth" | "not_found" | "invalid_status" | "db_error";
      message: string;
    };

/**
 * Server Action `archiveLeadSite(leadSiteId)` — arquiva um site (#169).
 *
 * Pipeline:
 *  1. Auth (Supabase) — sem usuário → `error: 'auth'`.
 *  2. Fetch lead_sites por id (via authenticated client, RLS isola).
 *  3. **Status guard** — `'published'` ou `'sent'` apenas. Caso contrário
 *     → `error: 'invalid_status'`.
 *  4. Update via service_role: `status='archived'`, `archived_at=now`.
 *  5. Cache invalidation: `updateTag('site:{slug}')` + `revalidatePath`.
 *
 * **Status mantido em DB mas a rota pública /sites/[slug] V1 ainda renderiza
 * sites arquivados** (V2: bloquear via guard na rota pra mostrar 410 Gone).
 * Por hora, `updateTag` força refresh em quem tem o link cacheado.
 */
export async function archiveLeadSite(
  leadSiteId: string,
): Promise<LeadSiteStatusActionResult> {
  // Step 1: Auth
  const server = await createServerSupabase();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "auth",
      message: "Você precisa estar autenticado para arquivar o site.",
    };
  }
  const userId = user.id;

  // Step 2: Fetch lead_site (RLS filtra por user_id)
  const { data: existing, error: fetchError } = await server
    .from("lead_sites")
    .select("id, lead_id, slug, status")
    .eq("id", leadSiteId)
    .maybeSingle();

  if (fetchError || !existing) {
    return {
      ok: false,
      error: "not_found",
      message: "Site não encontrado ou sem permissão de acesso.",
    };
  }

  // Step 3: Status guard (defesa em profundidade — UI já bloqueia)
  if (existing.status !== "published" && existing.status !== "sent") {
    return {
      ok: false,
      error: "invalid_status",
      message: "Apenas sites publicados ou enviados podem ser arquivados.",
    };
  }

  // Step 4: Update via service_role
  const service = createServiceSupabase();
  const nowIso = new Date().toISOString();
  const { error: updateError } = await service
    .from("lead_sites")
    .update({
      status: "archived" as const,
      archived_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", leadSiteId);

  if (updateError) {
    console.error("archiveLeadSite.persist", {
      action: "archiveLeadSite",
      step: "persist",
      leadSiteId,
      userId,
      errorName: updateError.name ?? "unknown",
      errorMessage: updateError.message ?? "",
    });
    return {
      ok: false,
      error: "db_error",
      message: "Falha ao arquivar o site. Tente novamente.",
    };
  }

  // Step 5: Cache invalidation
  // #213: também invalida `og:<slug>` (opengraph-image dinâmica) — site
  // arquivado para de servir OG image (handler retorna 404 via gate isIndexable).
  updateTag(`site:${existing.slug}`);
  updateTag(`og:${existing.slug}`);
  if (existing.lead_id) {
    revalidatePath(`/leads/${existing.lead_id}`);
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// restoreLeadSite (#169) — restaura site arquivado para publicado
// ---------------------------------------------------------------------------

/**
 * Server Action `restoreLeadSite(leadSiteId)` — restaura um site arquivado
 * de volta para `published` (#169).
 *
 * Pipeline:
 *  1. Auth (Supabase) — sem usuário → `error: 'auth'`.
 *  2. Fetch lead_sites por id (via authenticated client, RLS isola).
 *  3. **Status guard** — `'archived'` apenas. Caso contrário
 *     → `error: 'invalid_status'`.
 *  4. Update via service_role: `status='published'`, `archived_at=null`.
 *  5. Cache invalidation: `updateTag('site:{slug}')` + `revalidatePath`.
 */
export async function restoreLeadSite(
  leadSiteId: string,
): Promise<LeadSiteStatusActionResult> {
  // Step 1: Auth
  const server = await createServerSupabase();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "auth",
      message: "Você precisa estar autenticado para restaurar o site.",
    };
  }
  const userId = user.id;

  // Step 2: Fetch lead_site (RLS filtra por user_id)
  const { data: existing, error: fetchError } = await server
    .from("lead_sites")
    .select("id, lead_id, slug, status")
    .eq("id", leadSiteId)
    .maybeSingle();

  if (fetchError || !existing) {
    return {
      ok: false,
      error: "not_found",
      message: "Site não encontrado ou sem permissão de acesso.",
    };
  }

  // Step 3: Status guard
  if (existing.status !== "archived") {
    return {
      ok: false,
      error: "invalid_status",
      message: "Apenas sites arquivados podem ser restaurados.",
    };
  }

  // Step 4: Update via service_role
  const service = createServiceSupabase();
  const nowIso = new Date().toISOString();
  const { error: updateError } = await service
    .from("lead_sites")
    .update({
      status: "published" as const,
      archived_at: null,
      updated_at: nowIso,
    })
    .eq("id", leadSiteId);

  if (updateError) {
    console.error("restoreLeadSite.persist", {
      action: "restoreLeadSite",
      step: "persist",
      leadSiteId,
      userId,
      errorName: updateError.name ?? "unknown",
      errorMessage: updateError.message ?? "",
    });
    return {
      ok: false,
      error: "db_error",
      message: "Falha ao restaurar o site. Tente novamente.",
    };
  }

  // Step 5: Cache invalidation
  // #213: também invalida `og:<slug>` (opengraph-image dinâmica) — site
  // restaurado volta a servir OG image.
  updateTag(`site:${existing.slug}`);
  updateTag(`og:${existing.slug}`);
  if (existing.lead_id) {
    revalidatePath(`/leads/${existing.lead_id}`);
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// sendLeadSiteWhatsApp (#171) — envia o site gerado via WhatsApp (Evolution)
// ---------------------------------------------------------------------------

/**
 * Retorno discriminado de `sendLeadSiteWhatsApp` (#171).
 *
 * Erros:
 *  - `auth`              — usuário não autenticado.
 *  - `not_found`         — leadSiteId não existe ou não pertence ao usuário (RLS).
 *  - `invalid_status`    — status do site não é `'published'` ou `'sent'`
 *                          (defesa em profundidade — UI já bloqueia).
 *  - `rate_limit_daily`  — guard hard 50 envios/dia/instância (#173, anti-ban
 *                          WhatsApp). Bloqueia ANTES de tocar Evolution.
 *  - `whatsapp_error`    — falha no transporte Evolution (instância
 *                          desconectada, lead sem telefone válido, erro HTTP
 *                          do provider, etc.). A mensagem amigável vem do
 *                          helper `whatsappReasonMessage` para o usuário.
 *  - `db_error`          — falha de infra na escrita do tracking
 *                          (`status='sent'`, `sent_at=now`).
 */
export type SendLeadSiteWhatsAppResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "auth"
        | "not_found"
        | "invalid_status"
        | "rate_limit_daily"
        | "whatsapp_error"
        | "db_error";
      message: string;
    };

/**
 * Mapeia o `reason` discriminado de `sendWhatsAppMessage` (Phase 6) pra
 * mensagem amigável em PT-BR — usuário final vê isso via toast.
 */
function whatsappReasonMessage(
  reason:
    | "instance_disconnected"
    | "lead_not_found"
    | "lead_missing_phone"
    | "evolution_error",
): string {
  switch (reason) {
    case "instance_disconnected":
      return "Instância do WhatsApp desconectada. Reconecte em Configurações.";
    case "lead_not_found":
      return "Lead não encontrado para envio.";
    case "lead_missing_phone":
      return "O lead não possui telefone cadastrado.";
    case "evolution_error":
      return "Falha ao enviar via WhatsApp. Tente novamente em instantes.";
  }
}

/**
 * Server Action `sendLeadSiteWhatsApp(leadSiteId)` — dispara a prévia do site
 * gerado para o lead via WhatsApp/Evolution (#171).
 *
 * Pipeline:
 *  1. Auth (Supabase) — sem usuário → `error: 'auth'`.
 *  2. Fetch `lead_sites` por id (via authenticated client, RLS isola por
 *     `user_id`). Inclui `lead:leads(name)` em embed pra montar
 *     `business_name` na mensagem sem nova query.
 *  3. **Status guard** — `'published'` ou `'sent'` apenas; reenvio é permitido.
 *     Caso contrário → `error: 'invalid_status'`.
 *  4. Constrói `site_url` = `${NEXT_PUBLIC_APP_URL}/sites/${slug}`.
 *  5. Renderiza `SITE_PREVIEW_TEMPLATE` via `renderTemplate(...)` com
 *     `{ business_name, site_url }`. Caller é responsável por popular
 *     todas as variáveis declaradas em `TEMPLATE_VARIABLES`.
 *  6. Chama `sendWhatsAppMessage` (Phase 6) — esse helper já:
 *       a. valida instância conectada
 *       b. extrai/normaliza phone do lead
 *       c. INSERT lead_messages (status='queued')
 *       d. POST /message/sendText
 *       e. update lead_messages → 'sent' (com whatsapp_msg_id) ou 'failed'
 *       f. promove `lead.stage` `new` → `contacted` no primeiro outbound
 *     Se falhar → `error: 'whatsapp_error'` com mensagem mapeada.
 *  7. Update `lead_sites` via service_role: `status='sent'`, `sent_at=now`.
 *     `published_at` é preservado (esse já reflete a primeira publicação).
 *  8. Cache invalidation: `updateTag('site:{slug}')` + `revalidatePath`.
 *
 * **PII-safe logs:** apenas `errorName + errorMessage` em erros — sem
 * `cause`, stack, conteúdo da mensagem ou número do destinatário.
 *
 * **Idempotência (re-send):** status `'sent'` é aceito como input. Cada
 * envio insere novo `lead_messages` (timeline ganha entradas). `sent_at`
 * em `lead_sites` é sobrescrito com o último envio.
 */
export async function sendLeadSiteWhatsApp(
  leadSiteId: string,
): Promise<SendLeadSiteWhatsAppResult> {
  // Step 1: Auth
  const server = await createServerSupabase();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "auth",
      message: "Você precisa estar autenticado para enviar o site.",
    };
  }
  const userId = user.id;

  // Step 2: Fetch lead_site (RLS filtra por user_id) + fetch lead.name em
  // query separada (RLS-safe). Não usamos embed `lead:leads(name)` por causa
  // da ausência de relation declarada no schema gerado — TS estreita a Row
  // pra `never`. Duas queries simples + RLS é o caminho seguro.
  const { data: existing, error: fetchError } = await server
    .from("lead_sites")
    .select("id, lead_id, slug, status")
    .eq("id", leadSiteId)
    .maybeSingle();

  if (fetchError || !existing) {
    return {
      ok: false,
      error: "not_found",
      message: "Site não encontrado ou sem permissão de acesso.",
    };
  }

  // Step 3: Status guard — re-send permitido (status='sent' aceito).
  if (existing.status !== "published" && existing.status !== "sent") {
    return {
      ok: false,
      error: "invalid_status",
      message: "Apenas sites publicados ou enviados podem ser disparados.",
    };
  }

  // Step 3.5: Guard hard 50 envios/dia/instância (#173, anti-ban WhatsApp).
  // Acontece ANTES de fetch lead.name + render + Evolution — economiza
  // trabalho e zera risco de tocar o provider acima do limite. Em massa
  // (campanhas), o processor mapeia esse `reason` pra 'failed' (não
  // 'skipped') — operador deve ter awareness pra retentar amanhã, não
  // silently skip.
  const limitCheck = await checkDailyInstanceLimit(userId, server);
  if (!limitCheck.allowed) {
    return {
      ok: false,
      error: "rate_limit_daily",
      message: `Limite diário de ${DAILY_INSTANCE_LIMIT} envios atingido para esta instância. Tente amanhã.`,
    };
  }

  // Fetch lead.name para popular `business_name` no template. RLS já
  // garantiu que o user_id corresponde via lead_sites; lead deve existir,
  // mas defesa em profundidade com fallback.
  const { data: leadRow } = await server
    .from("leads")
    .select("name")
    .eq("id", existing.lead_id)
    .maybeSingle();
  const businessNameRaw = (leadRow?.name ?? "").trim();
  const businessName =
    businessNameRaw.length > 0 ? businessNameRaw : "Concessionária";

  // Step 4: Build site_url
  const siteUrl = `${env.NEXT_PUBLIC_APP_URL}/sites/${existing.slug}`;

  // Step 5: Render template — `renderTemplate` (single-brace) lança em
  // variável faltante (defensiva). Aqui passamos as duas declaradas em
  // `TEMPLATE_VARIABLES`.
  let content: string;
  try {
    content = renderTemplate(SITE_PREVIEW_TEMPLATE, {
      business_name: businessName,
      site_url: siteUrl,
    });
  } catch (cause) {
    // Bug de programação (variable missing). Não expõe internals.
    console.error("sendLeadSiteWhatsApp.render", {
      action: "sendLeadSiteWhatsApp",
      step: "render",
      leadSiteId,
      userId,
      errorName: cause instanceof Error ? cause.name : "unknown",
      errorMessage: cause instanceof Error ? cause.message : String(cause),
    });
    return {
      ok: false,
      error: "whatsapp_error",
      message: "Falha ao montar a mensagem. Tente novamente.",
    };
  }

  // Step 6: Send via Evolution (helper Phase 6 cobre instance, lead,
  // INSERT lead_messages, sendText, update status, lead.stage promotion).
  const sendOutcome = await sendWhatsAppMessage({
    supabase: server,
    userId,
    leadId: existing.lead_id,
    content,
    aiGenerated: false,
  });

  if (!sendOutcome.ok) {
    console.error("sendLeadSiteWhatsApp.send", {
      action: "sendLeadSiteWhatsApp",
      step: "send",
      leadSiteId,
      userId,
      reason: sendOutcome.reason,
    });
    return {
      ok: false,
      error: "whatsapp_error",
      message: whatsappReasonMessage(sendOutcome.reason),
    };
  }

  // Step 7: Update lead_sites (status='sent', sent_at=now) via service_role.
  const service = createServiceSupabase();
  const nowIso = new Date().toISOString();
  const { error: updateError } = await service
    .from("lead_sites")
    .update({
      status: "sent" as const,
      sent_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", leadSiteId);

  if (updateError) {
    console.error("sendLeadSiteWhatsApp.persist", {
      action: "sendLeadSiteWhatsApp",
      step: "persist",
      leadSiteId,
      userId,
      errorName: updateError.name ?? "unknown",
      errorMessage: updateError.message ?? "",
    });
    return {
      ok: false,
      error: "db_error",
      message:
        "Mensagem enviada, mas falha ao atualizar o site. Tente reenviar.",
    };
  }

  // Step 8: Cache invalidation
  // #213: também invalida `og:<slug>` (opengraph-image dinâmica) — status
  // transicionou `published` → `sent`, ainda indexável.
  updateTag(`site:${existing.slug}`);
  updateTag(`og:${existing.slug}`);
  if (existing.lead_id) {
    revalidatePath(`/leads/${existing.lead_id}`);
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// `getLeadSiteCardData(leadId)` — read-only fetch para o `<LeadSiteCardClient>`
// usado no drawer da ficha do lead. RLS isola por `user_id`. Em caso de erro
// (RLS/network), retorna `null` graceful — UI mostra estado "none" e usuário
// pode tentar gerar.
// ---------------------------------------------------------------------------

export interface LeadSiteCardDataResult {
  leadSite: {
    id: string;
    slug: string;
    status: "draft" | "published" | "sent" | "archived";
    generated_at: string | null;
    published_at: string | null;
    sent_at: string | null;
    view_count: number;
    variables: unknown | null;
  } | null;
  appUrl: string;
}

export async function getLeadSiteCardData(
  leadId: string,
): Promise<LeadSiteCardDataResult> {
  const server = await createServerSupabase();

  const { data, error } = await server
    .from("lead_sites")
    .select(
      "id, slug, status, generated_at, published_at, sent_at, view_count, variables",
    )
    .eq("lead_id", leadId)
    .maybeSingle();

  if (error) {
    console.error("getLeadSiteCardData.fetch", {
      action: "getLeadSiteCardData",
      leadId,
      errorName: error.name ?? "unknown",
      errorMessage: error.message ?? "",
    });
  }

  return {
    leadSite: (data as LeadSiteCardDataResult["leadSite"]) ?? null,
    appUrl: env.NEXT_PUBLIC_APP_URL,
  };
}
