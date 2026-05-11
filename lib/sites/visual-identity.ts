/**
 * `lib/sites/visual-identity.ts` — pipeline de geração de identidade
 * visual AI por site (Phase 7 Sprint 2 #A2, issue #216).
 *
 * Entrega 9 assets V1 matching schema `VisualIdentityManifestSchema`
 * (#215):
 *
 *   - 1 `hero_url` — banner principal home (1536x1024 medium).
 *   - até 6 `categories_urls[]` — banner por categoria presente nos cars
 *     do site (1024x1024 medium). Categorias derivadas do enum em
 *     `SiteCar.category`: SUV, Sedan, Hatch, Pickup, Esportivo, Conversível.
 *   - 1 `about_url` — hero da página /sobre (1536x1024 medium).
 *   - 1 `contact_url` — hero da página /contato (1536x1024 medium).
 *
 * **Custo target:** ~$0.49 USD/cliente (Tier-1 OpenAI). Conversão USD→BRL
 * × `env.BRL_RATE` (default 5.0) — hardcoded V1, sem realtime FX.
 *
 * **Anti-hallucination:** cada template inclui literal clause negativa
 * proibindo text/logos/license plates/brand marks visíveis. Snapshot-locked
 * em test pra catch regressões.
 *
 * Exports:
 *   - `ALL_ASSET_SPECS` — 9 specs estáticas (key, size, quality).
 *   - `buildAssetSpecsForCars(cars)` — deriva specs efetivas (categories
 *     filtradas pelas categorias presentes nos cars; min 1, max 6).
 *   - `buildPrompt(spec, ctx)` — interpola contexto no template; puro.
 *   - `buildIdentityContext(siteVars)` — extrai biz_name/city/state/color do v1/v2.
 *   - `estimateTotalCost(specs, modelOverride?)` — soma PRICING_USD.
 *   - `uploadAssetToStorage({b64, slug, key, supabase})` — service_role upload.
 *   - `deleteExistingAssets(slug, supabase)` — list + remove pré-rerun.
 */
import "server-only";

import { z } from "zod";

import {
  PRICING_USD,
  type ImageModel,
  type ImageQuality,
  type ImageSize,
} from "@/lib/openai/image-client";
import { env } from "@/lib/env";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

/**
 * Bucket público criado em migration 0019. Banners de marketing —
 * service_role write, anyone read.
 */
export const VISUAL_IDENTITY_BUCKET = "visual-identity";

/**
 * Categorias suportadas, espelham `SiteCar.category` enum em
 * `types/lead-site.ts`. Ordem é estável → categories_urls[] segue esta
 * mesma ordem pra render consistente.
 */
export const CAR_CATEGORIES = [
  "SUV",
  "Sedan",
  "Hatch",
  "Pickup",
  "Esportivo",
  "Conversível",
] as const;

export type CarCategory = (typeof CAR_CATEGORIES)[number];

/**
 * Variantes de asset suportadas no manifest V1. `category_<x>` é gerada
 * dinamicamente baseado nas categorias presentes nos `cars[]` do site.
 */
export type AssetVariant =
  | "hero"
  | "about"
  | "contact"
  | "category_suv"
  | "category_sedan"
  | "category_hatch"
  | "category_pickup"
  | "category_esportivo"
  | "category_conversivel";

export interface AssetSpec {
  key: AssetVariant;
  size: ImageSize;
  quality: ImageQuality;
  /** Mapping back to manifest field. */
  manifestField:
    | "hero_url"
    | "about_url"
    | "contact_url"
    | "categories_urls";
  /** Posição em `categories_urls[]` quando manifestField=categories_urls. */
  categoryIndex?: number;
}

/**
 * Contexto extraído de SiteVariables (v1 ou v2) — entrada do
 * `buildPrompt`. Helpers `buildIdentityContext` faz a extração defensive.
 */
export interface IdentityContext {
  business_name: string;
  city: string | null;
  state: string | null;
  primary_color: string;
}

// ---------------------------------------------------------------------------
// ALL_ASSET_SPECS (9 entries) — derivado do schema #249
// ---------------------------------------------------------------------------

/**
 * Specs estáticas dos 9 assets V1. Categorias são incluídas todas aqui;
 * `buildAssetSpecsForCars` filtra dinamicamente pelas categorias presentes.
 *
 * Sizes baseadas no spike doc (`tmp/research/openai-image-spike.md`):
 *   - hero/about/contact: 1536x1024 medium ≈ $0.063 cada × 3 = $0.189
 *   - categories: 1024x1024 medium ≈ $0.042 cada × ≤6 = ≤$0.252
 *   - Total ≤$0.441 USD (≤R$2.21 a 5.0)
 *
 * **Nota:** valor real custo varia conforme quantas categorias o site
 * tem. Min 1 (site só com Sedans, p.ex.) → ~$0.231. Max 6 (mistura
 * completa) → ~$0.441. Cost guardrail no caller protege contra runaway.
 */
export const ALL_ASSET_SPECS: AssetSpec[] = [
  { key: "hero", size: "1536x1024", quality: "medium", manifestField: "hero_url" },
  { key: "about", size: "1536x1024", quality: "medium", manifestField: "about_url" },
  { key: "contact", size: "1536x1024", quality: "medium", manifestField: "contact_url" },
  { key: "category_suv", size: "1024x1024", quality: "medium", manifestField: "categories_urls", categoryIndex: 0 },
  { key: "category_sedan", size: "1024x1024", quality: "medium", manifestField: "categories_urls", categoryIndex: 1 },
  { key: "category_hatch", size: "1024x1024", quality: "medium", manifestField: "categories_urls", categoryIndex: 2 },
  { key: "category_pickup", size: "1024x1024", quality: "medium", manifestField: "categories_urls", categoryIndex: 3 },
  { key: "category_esportivo", size: "1024x1024", quality: "medium", manifestField: "categories_urls", categoryIndex: 4 },
  { key: "category_conversivel", size: "1024x1024", quality: "medium", manifestField: "categories_urls", categoryIndex: 5 },
];

const VARIANT_TO_CATEGORY: Record<string, CarCategory> = {
  category_suv: "SUV",
  category_sedan: "Sedan",
  category_hatch: "Hatch",
  category_pickup: "Pickup",
  category_esportivo: "Esportivo",
  category_conversivel: "Conversível",
};

/**
 * Filtra `ALL_ASSET_SPECS` para incluir apenas categorias presentes nos
 * `cars[]` do site. Sempre inclui hero/about/contact (não-categorial).
 *
 * Regras:
 *   - Sempre retorna hero, about, contact (3 fixos).
 *   - Inclui `category_X` somente se algum car tem `category === X`.
 *   - Se nenhuma categoria identificada (cars sem `category` field —
 *     v1 legado), inclui Sedan como default (mais comum).
 *   - Garantia: pelo menos 1 categoria (manifest exige `min(1)`).
 */
export function buildAssetSpecsForCars(
  cars: Array<{ category?: CarCategory | string | null }>,
): AssetSpec[] {
  const present = new Set<CarCategory>();
  for (const car of cars) {
    if (car.category && (CAR_CATEGORIES as readonly string[]).includes(car.category)) {
      present.add(car.category as CarCategory);
    }
  }
  // Fallback: nenhuma categoria → Sedan default (sempre 1 cat min)
  if (present.size === 0) {
    present.add("Sedan");
  }

  const specs: AssetSpec[] = [];
  for (const spec of ALL_ASSET_SPECS) {
    if (spec.manifestField !== "categories_urls") {
      specs.push(spec);
      continue;
    }
    const cat = VARIANT_TO_CATEGORY[spec.key];
    if (cat && present.has(cat)) specs.push(spec);
  }

  // Re-index categoryIndex sequencialmente (manifest é array dense).
  let catCounter = 0;
  return specs.map((spec) => {
    if (spec.manifestField === "categories_urls") {
      return { ...spec, categoryIndex: catCounter++ };
    }
    return spec;
  });
}

// ---------------------------------------------------------------------------
// Prompt templates — anti-hallucination clauses snapshot-locked
// ---------------------------------------------------------------------------

/**
 * Clausula anti-hallucination presente em TODOS os templates. Snapshot
 * test verifica que essa string permanece intacta — prompt drift causa
 * watermarks, plates, brand logos de marcas reais (BMW, Toyota, etc)
 * vazarem.
 */
export const ANTI_HALLUCINATION_CLAUSE =
  "Do NOT include any of the following: text, words, letters, numbers, logos, brand marks, license plates, watermarks, recognizable brand badges (BMW/Toyota/Honda/Ford/etc — use generic silhouettes only), human faces, copyrighted iconography, dealer signage, or any readable typography.";

/**
 * Templates per variant. Interpolação simples `{{business_name}}` /
 * `{{city}}` / `{{primary_color}}`. Caller usa `buildPrompt(spec, ctx)`.
 */
const PROMPT_TEMPLATES: Record<AssetVariant, string> = {
  hero: `Cinematic 16:9 hero banner for a Brazilian car dealership called "{{business_name}}" located in {{city_state}}. Composition: dynamic three-quarter angle of a generic modern car silhouette against a sweeping urban sunset backdrop. Lighting: golden hour, soft warm glow, lens flare reserved and tasteful. Color palette: anchored on the brand color {{primary_color}} with complementary warm neutrals. Mood: aspirational, premium, trustworthy. Style: photorealistic editorial automotive photography, high dynamic range, shallow depth of field. ${ANTI_HALLUCINATION_CLAUSE}`,

  about: `Editorial 16:9 image representing the heritage and team behind a Brazilian car dealership called "{{business_name}}" in {{city_state}}. Composition: a stylized dealership lot at dawn with generic car silhouettes parked in soft mist, no people visible. Lighting: cool diffuse morning light contrasted with warm interior glow from a showroom in the distance. Color palette: anchored on {{primary_color}} with muted blues and creams. Mood: established, family-owned, decades-of-experience. Style: photorealistic environmental photography, wide tonal range. ${ANTI_HALLUCINATION_CLAUSE}`,

  contact: `Welcoming 16:9 contact-page hero for a Brazilian car dealership called "{{business_name}}" in {{city_state}}. Composition: empty modern showroom interior with polished concrete floors and large floor-to-ceiling windows looking onto greenery, suggesting accessibility and openness. Lighting: bright natural daylight from windows, warm accent lighting above. Color palette: neutral grays and whites with single accent surface in {{primary_color}}. Mood: open, professional, easy to approach. Style: architectural interior photography, clean lines, no clutter. ${ANTI_HALLUCINATION_CLAUSE}`,

  category_suv: `Square 1:1 category banner showing a generic SUV silhouette in a rugged outdoor environment (mountain road, off-road trail). Three-quarter front angle, vehicle in motion suggested by light dust. Lighting: dramatic side lighting, late afternoon. Color palette: earth tones with {{primary_color}} accent in the sky or background gradient. Mood: adventurous, capable, family-ready. Style: editorial automotive photography, photorealistic, generic body shape. ${ANTI_HALLUCINATION_CLAUSE}`,

  category_sedan: `Square 1:1 category banner showing a generic sedan silhouette parked on a clean urban street at dusk. Three-quarter angle. Lighting: city lights beginning to glow, soft purple-to-gold sky. Color palette: cool urban grays with {{primary_color}} as accent in lights and reflections. Mood: elegant, refined, executive. Style: editorial automotive photography, photorealistic, generic sedan body. ${ANTI_HALLUCINATION_CLAUSE}`,

  category_hatch: `Square 1:1 category banner showing a generic hatchback silhouette in a vibrant city scene during daytime. Three-quarter front angle, suggesting energy and youth. Lighting: bright cheerful daylight, soft shadows. Color palette: vivid and friendly with {{primary_color}} as primary accent. Mood: youthful, practical, fun. Style: editorial automotive photography, photorealistic, generic hatchback body. ${ANTI_HALLUCINATION_CLAUSE}`,

  category_pickup: `Square 1:1 category banner showing a generic pickup truck silhouette on a rural road or work site. Three-quarter angle suggesting strength and utility. Lighting: morning sunlight, long shadows. Color palette: warm earth tones with {{primary_color}} as a vehicle highlight or sky accent. Mood: rugged, hard-working, dependable. Style: editorial automotive photography, photorealistic, generic pickup body. ${ANTI_HALLUCINATION_CLAUSE}`,

  category_esportivo: `Square 1:1 category banner showing a generic sports car silhouette on a curved coastal highway at sunset. Low three-quarter angle emphasizing aerodynamics. Lighting: dramatic golden hour, lens flare. Color palette: deep saturated blues and oranges with {{primary_color}} as dominant vehicle hue. Mood: thrilling, performance-oriented, aspirational. Style: editorial automotive photography, photorealistic, generic sports-car silhouette. ${ANTI_HALLUCINATION_CLAUSE}`,

  category_conversivel: `Square 1:1 category banner showing a generic convertible silhouette with top down on a scenic open road. Three-quarter rear angle suggesting freedom. Lighting: bright sun, deep blue sky. Color palette: vivid sky blue and warm sand with {{primary_color}} as vehicle accent. Mood: free, joyful, vacation-feeling. Style: editorial automotive photography, photorealistic, generic convertible silhouette. ${ANTI_HALLUCINATION_CLAUSE}`,
};

/**
 * Interpola contexto no template do spec. **Puro.**
 *
 * Substitui `{{business_name}}`, `{{city_state}}`, `{{primary_color}}`.
 * `city_state` é "São Paulo, SP" se ambos presentes; "{city}" sem state;
 * "Brasil" se ambos null (defensive fallback).
 */
export function buildPrompt(
  spec: AssetSpec,
  ctx: IdentityContext,
): string {
  const template = PROMPT_TEMPLATES[spec.key];
  const cityState =
    ctx.city && ctx.state
      ? `${ctx.city}, ${ctx.state}`
      : ctx.city
        ? ctx.city
        : "Brasil";

  return template
    .replaceAll("{{business_name}}", ctx.business_name)
    .replaceAll("{{city_state}}", cityState)
    .replaceAll("{{primary_color}}", ctx.primary_color);
}

// ---------------------------------------------------------------------------
// buildIdentityContext — extrai contexto de SiteVariables (v1 ou v2)
// ---------------------------------------------------------------------------

const ContextInputSchema = z
  .object({
    business_name: z.string().optional(),
    // v2 fields
    address: z
      .object({
        city: z.string().optional(),
        state: z.string().optional(),
      })
      .nullable()
      .optional(),
    brand_assets: z
      .object({
        primary_color: z.string().optional(),
      })
      .optional(),
    // v1 flat fields (compat)
    address_line: z.string().nullable().optional(),
    primary_color: z.string().optional(),
  })
  .passthrough();

/**
 * Extrai `IdentityContext` de um `SiteVariables` (v1 ou v2). Defensive —
 * input não é validado por Zod aqui (caller já fez via `readSiteVariables`),
 * apenas narrowing tipos. Fallbacks sensatos:
 *
 *   - `business_name`: required (lança se faltar — caller deve garantir).
 *   - `city` / `state`: v2 `address.{city,state}` → v1 não tem (returns null).
 *   - `primary_color`: v2 `brand_assets.primary_color` → v1 `primary_color`
 *     → fallback `#0c0c0c` (preto neutro, sempre válido pra prompt).
 */
export function buildIdentityContext(siteVars: unknown): IdentityContext {
  const parsed = ContextInputSchema.parse(siteVars);
  const business_name = parsed.business_name?.trim();
  if (!business_name || business_name.length === 0) {
    throw new Error("buildIdentityContext: business_name é obrigatório");
  }

  // v2 first
  const v2City = parsed.address?.city ?? null;
  const v2State = parsed.address?.state ?? null;
  const v2Color = parsed.brand_assets?.primary_color ?? null;

  // v1 fallback (no city extraction — address_line é freeform)
  const v1Color = parsed.primary_color ?? null;

  const primary_color = (v2Color ?? v1Color ?? "#0c0c0c").trim();

  return {
    business_name,
    city: v2City ?? null,
    state: v2State ?? null,
    primary_color,
  };
}

// ---------------------------------------------------------------------------
// estimateTotalCost — soma PRICING_USD; retorna USD + BRL convertido
// ---------------------------------------------------------------------------

export interface CostEstimate {
  usd: number;
  brl: number;
}

/**
 * Soma o custo dos specs em USD usando PRICING_USD, converte para BRL
 * com `env.BRL_RATE` (default 5.0 — hardcoded V1, sem realtime FX).
 *
 * `modelOverride` permite estimar custo de fallback (gpt-image-1-mini).
 */
export function estimateTotalCost(
  specs: AssetSpec[],
  modelOverride?: ImageModel,
): CostEstimate {
  const model: ImageModel = modelOverride ?? "gpt-image-2-2026-04-21";
  const usd = specs.reduce(
    (acc, spec) => acc + PRICING_USD[model][spec.size][spec.quality],
    0,
  );
  const brl = usd * env.BRL_RATE;
  // Round a 4 decimais USD, 2 BRL (cents) — evita float noise em snapshots.
  return {
    usd: Math.round(usd * 10000) / 10000,
    brl: Math.round(brl * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Storage I/O (service_role)
// ---------------------------------------------------------------------------

export interface UploadAssetParams {
  b64: string;
  slug: string;
  key: AssetVariant;
  supabase: SupabaseClient<Database>;
}

/**
 * Upload de PNG b64 → bucket `visual-identity`. Path padrão:
 * `<slug>/<key>-<timestamp>.png`. Retorna URL pública.
 *
 * **service_role obrigatório** — bucket policies restringem write a
 * `auth.role() = 'service_role'`. Caller passa `createServiceSupabase()`.
 *
 * **upsert=true** porque path tem timestamp único; mas se o mesmo
 * request gerar duplicate (impossível, mas defensivo), evita 409.
 */
export async function uploadAssetToStorage(
  params: UploadAssetParams,
): Promise<string> {
  const { b64, slug, key, supabase } = params;
  const buffer = Buffer.from(b64, "base64");
  const timestamp = Date.now();
  const path = `${slug}/${key}-${timestamp}.png`;

  const { error: uploadError } = await supabase.storage
    .from(VISUAL_IDENTITY_BUCKET)
    .upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(
      `uploadAssetToStorage: falha ao subir ${path} — ${uploadError.message}`,
    );
  }

  const { data } = supabase.storage
    .from(VISUAL_IDENTITY_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Lista e deleta todos os arquivos em `visual-identity/<slug>/*`.
 * Usado pelo caller quando `options.force = true` (regenerate completo).
 *
 * Idempotente: se bucket vazio ou slug não existe, no-op silencioso.
 */
export async function deleteExistingAssets(
  slug: string,
  supabase: SupabaseClient<Database>,
): Promise<void> {
  const { data: list, error: listError } = await supabase.storage
    .from(VISUAL_IDENTITY_BUCKET)
    .list(slug);

  if (listError) {
    throw new Error(
      `deleteExistingAssets: falha ao listar ${slug}/ — ${listError.message}`,
    );
  }

  if (!list || list.length === 0) return;

  const paths = list.map((item) => `${slug}/${item.name}`);
  const { error: removeError } = await supabase.storage
    .from(VISUAL_IDENTITY_BUCKET)
    .remove(paths);

  if (removeError) {
    throw new Error(
      `deleteExistingAssets: falha ao remover assets de ${slug}/ — ${removeError.message}`,
    );
  }
}
