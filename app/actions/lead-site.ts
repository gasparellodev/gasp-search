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

import {
  GENERATION_MODEL,
  GENERATION_VERSION,
  generateCopy,
} from "@/lib/sites/generate-copy";
import { extractBrandAssets } from "@/lib/sites/brand-assets";
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
import { slugify } from "@/lib/utils/slug";
import type { Database } from "@/types/database";
import { SiteVariables } from "@/types/lead-site";

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
const FALLBACK_IMAGE_URL = "https://placehold.co/1024x768/0c0c0c/ffffff.png";
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
  },
): void {
  // PII-safe: `error.name + error.message` — sem `cause` (pode conter dado
  // adversarial) e sem stack trace.
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
 * Compõe `SiteVariables` final a partir do lead, brand assets e copy IA.
 *
 * Campos derivados de cada fonte:
 *  - Lead: `business_name`, `business_slug`, `whatsapp`, `phone_display`,
 *          `email`, `instagram_url`, `address_line`.
 *  - Assets: `logo_url`, `primary_color`, `text_on_primary`, hero/about/contact
 *           images, `car_placeholder_urls` (pra `home_categories.image_url`,
 *           `emphasis.image_url`, `recent_sales[].image_url` e `cars[].thumbnail_url`).
 *  - Copy: `slogan`, `home_categories[].label`, `emphasis.{title,description}`,
 *          `about_text`, `mission`, `vision`, `values`, `cars[].{description,...}`.
 *  - Constantes: `generated_by`, `generation_version`.
 */
function mergeSiteVariables(
  lead: Lead,
  assets: AssetSources,
  copy: Awaited<ReturnType<typeof generateCopy>>,
): unknown {
  const businessName = lead.name;
  const businessSlug = slugify(businessName);

  // WhatsApp: o schema exige 10-13 dígitos. Lead pode ter formatos variados;
  // melhor esforço strip não-dígitos. Se ficar fora, parse final falha (AC8).
  const whatsappDigits = (lead.whatsapp ?? lead.phone ?? "").replace(/\D/g, "");
  const phoneDisplay = lead.phone ?? lead.whatsapp ?? "";

  const instagramUrl =
    lead.instagram_handle && lead.instagram_handle.length > 0
      ? `https://instagram.com/${lead.instagram_handle.replace(/^@/, "")}`
      : null;

  const cityState = [lead.city, lead.state].filter(Boolean).join(", ");
  const addressLine = cityState.length > 0 ? cityState : null;

  // Mapping de car_placeholder_urls pros 6 carros do schema:
  // - emphasis.image_url: 0
  // - recent_sales[0..2]: 1, 2, 3 (length === 3)
  // - home_categories[0..2]: 0, 1, 2 (reuso ok — image_url só)
  // - cars[].thumbnail_url e gallery_urls: 4 e 5 com fallback dentre os 6.
  const carUrls = assets.car_placeholder_urls;
  const safeCarAt = (i: number): string =>
    carUrls[i] ?? carUrls[0] ?? FALLBACK_IMAGE_URL;

  // Composição de cars: copy emite 4-6 entries com {description, datasheet,
  // featured}. Schema completo (#154 SiteCar) exige mais campos. Adicionar
  // defaults consistentes — esta é a primeira versão; iterações futuras vão
  // melhorar a heurística.
  const fullCars = copy.cars.map((c, idx) => ({
    slug: `car-${idx + 1}`,
    brand: lead.name.split(" ")[0] ?? "Carro",
    model: `Modelo ${idx + 1}`,
    year: new Date().getFullYear() - (idx % 3),
    km: idx * 12_000,
    price: null,
    transmission: "Automático" as const,
    fuel: "Flex" as const,
    color: "Branco",
    description: c.description,
    thumbnail_url: safeCarAt(idx + 4 < carUrls.length ? idx + 4 : idx),
    gallery_urls: [
      safeCarAt(idx % carUrls.length),
      safeCarAt((idx + 1) % carUrls.length),
      safeCarAt((idx + 2) % carUrls.length),
    ],
    datasheet: c.datasheet,
    featured: c.featured,
  }));

  return {
    // Globais
    business_name: businessName,
    business_slug: businessSlug,
    slogan: copy.slogan,
    primary_color: assets.primary_color,
    text_on_primary: assets.text_on_primary,
    logo_url: assets.logo_url,
    whatsapp: whatsappDigits,
    phone_display: phoneDisplay,
    email: lead.email,
    instagram_url: instagramUrl,
    facebook_url: null,
    youtube_url: null,
    address_line: addressLine,
    hours: null,

    // Home
    hero_image_url: assets.hero_image_url,
    home_categories: copy.home_categories.map((c, i) => ({
      label: c.label,
      image_url: safeCarAt(i),
    })),
    emphasis: {
      title: copy.emphasis.title,
      car_name: `${lead.name.split(" ")[0] ?? "Modelo"} Destaque`,
      description: copy.emphasis.description,
      image_url: safeCarAt(0),
    },
    recent_sales: [
      { car_name: "Recente 1", image_url: safeCarAt(1) },
      { car_name: "Recente 2", image_url: safeCarAt(2) },
      { car_name: "Recente 3", image_url: safeCarAt(3) },
    ],

    // Sobre
    about_text: copy.about_text,
    about_image_url: assets.about_image_url,
    mission: copy.mission,
    vision: copy.vision,
    values: copy.values,

    // Contato
    contact_hero_image_url: assets.contact_hero_image_url,

    // Estoque
    cars: fullCars,

    // Metadata
    generated_by: GENERATION_MODEL,
    generation_version: GENERATION_VERSION,
  };
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

  // Step 8 + 9: Merge + SiteVariables.parse (defesa final)
  const merged = mergeSiteVariables(lead, assets, copy);
  let variables: ReturnType<typeof SiteVariables.parse>;
  try {
    variables = SiteVariables.parse(merged);
  } catch (cause) {
    const validationError = new SiteVariablesValidationError(cause);
    logError("validate", { leadId, userId, error: validationError });
    const issuesSerialized =
      cause instanceof ZodError
        ? cause.issues.map((i) => `${i.path.join(".")}: ${i.code}`).join("; ")
        : "unknown";
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
  updateTag(`site:${slug}`);
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
 * Lista de campos de `SiteVariables` que aceitam URL e devem passar por
 * `safeUrl()` antes do merge — defesa em profundidade contra schemes
 * maliciosos (`javascript:`, `data:`, `file:`, `vbscript:`).
 *
 * `cars[].thumbnail_url`, `cars[].gallery_urls[]`, `home_categories[].image_url`,
 * `emphasis.image_url` e `recent_sales[].image_url` são tratados em
 * `sanitizePatchUrls` via passes específicos.
 */
const TOP_LEVEL_URL_FIELDS = [
  "logo_url",
  "hero_image_url",
  "about_image_url",
  "contact_hero_image_url",
  "instagram_url",
  "facebook_url",
  "youtube_url",
] as const;

/**
 * Aplica `safeUrl()` em todos os campos de URL do patch. URLs com scheme
 * malicioso viram `null` (ou são removidas do patch para campos não-nullable
 * — nesse caso o validador final reprova a tentativa).
 *
 * Estratégia:
 *  - Para nullable URLs (`instagram_url`, `facebook_url`, `youtube_url`),
 *    `null` é aceito.
 *  - Para non-nullable URLs (`logo_url`, `hero_image_url`, ...),
 *    `safeUrl` retornar `null` faz a SiteVariables.parse final falhar
 *    com error 'validation' — comportamento correto (rejeitar input
 *    sujo em vez de "limpar silenciosamente").
 *  - Para arrays (gallery_urls), aplica em cada item; itens inválidos
 *    viram `null` e o parse final reprova.
 */
function sanitizePatchUrls(
  patch: Partial<SiteVariables>,
): Partial<SiteVariables> {
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

  // cars[].thumbnail_url + cars[].gallery_urls[]
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
    }));
  }

  return out as Partial<SiteVariables>;
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
  patch: Partial<SiteVariables>,
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
  // do merge — proteção contra payload adversarial).
  const partialParse = SiteVariables.partial().safeParse(patch);
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

  // Step 7: Validação final completa
  let variables: SiteVariables;
  try {
    variables = SiteVariables.parse(merged);
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
  updateTag(`site:${existing.slug}`);
  if (existing.lead_id) {
    revalidatePath(`/leads/${existing.lead_id}`);
  }

  return { ok: true, slug: existing.slug };
}
