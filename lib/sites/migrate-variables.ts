/**
 * Migrate `lead_sites.variables` v1 → v2 (issue #197).
 *
 * **Pure function module — sem I/O, sem Supabase client.** Caller decide se
 * persiste o resultado migrado de volta no banco. V1 não persiste — usado
 * apenas como fallback gracioso de leitura durante janela de deploy
 * (app já contém v2 pre-migration; migration roda; reads desaparecem).
 *
 * Uso canônico em rotas:
 * ```ts
 * import { readSiteVariables } from "@/lib/sites/migrate-variables";
 * const variables = readSiteVariables(rowFromDB.variables);
 * ```
 *
 * Logging: cada vez que o caminho v1 é exercido, `console.warn` audita.
 * Esperado zero warns 24h pós-migration aplicada.
 */

import {
  SiteCar,
  SiteVariablesV1,
  SiteVariablesV2,
  type Address as AddressType,
  type BrandAssets as BrandAssetsType,
} from "@/types/lead-site";
import type { ZodError } from "zod";

// ===========================================================================
// Discriminação
// ===========================================================================

/**
 * Returns `true` if `raw` is a v1-shaped record (sem `schema_version`).
 *
 * Heurística forte: v1 sempre tinha `primary_color` flat e v2 sempre tem
 * `schema_version: 2`. Se objeto é null/non-object, retorna `false` (caller
 * trata via Zod `.parse` que joga ZodError).
 */
export function isV1(raw: unknown): boolean {
  if (raw === null || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  if (typeof obj["schema_version"] === "number") return false;
  // Discriminator forte: v1 sempre tinha primary_color flat
  return typeof obj["primary_color"] === "string";
}

// ===========================================================================
// Migração (pure)
// ===========================================================================

/**
 * Best-effort parse de `address_line` v1 → `Address` v2.
 *
 * Padrões aceitos:
 *   - `"Av. Paulista, 1000 — Bela Vista, São Paulo - SP, 01310-100"`
 *   - `"Rua X, 123 - Bairro, Cidade - SP, 12345-678"`
 *   - `"Av. Y, S/N — Centro, Cidade - RJ, 22000-000"`
 *
 * Retorna `null` se regex não casar — Zod `Address` é `.nullable()`.
 */
function parseAddressLine(addressLine: string | null): AddressType | null {
  if (!addressLine || addressLine.trim().length === 0) return null;

  // Pattern: street, number — neighborhood, city - UF, ZIP
  // Aceita travessão "—" ou hífen "-" como separador.
  const re =
    /^(.*?),\s*(\d+|S\/N|s\/n)\s*[—\-]\s*([^,]+?),\s*([^,]+?)\s*-\s*([A-Z]{2})\s*,?\s*(\d{5}-?\d{3})\s*$/u;

  const match = addressLine.match(re);
  if (!match) return null;

  const [, street, number, neighborhood, city, state, zip] = match;
  if (!street || !number || !neighborhood || !city || !state || !zip) {
    return null;
  }

  return {
    street: street.trim(),
    number: number.trim(),
    neighborhood: neighborhood.trim(),
    city: city.trim(),
    state: state.trim(),
    zip: zip.trim(),
    country: "BR",
  };
}

/**
 * Constrói `BrandAssets` v2 nested a partir de campos flat v1.
 *
 * Mapeamento direto exceto `contact_hero_image_url` → `contact_image_url`
 * (renomeação canônica em v2). `car_placeholders` default `[]` (v1 não
 * tinha o conceito; é populado pelo brand-pipeline em writes novos).
 */
function buildBrandAssets(v1: SiteVariablesV1): BrandAssetsType {
  return {
    logo_url: v1.logo_url,
    primary_color: v1.primary_color,
    text_on_primary: v1.text_on_primary,
    hero_image_url: v1.hero_image_url,
    about_image_url: v1.about_image_url,
    contact_image_url: v1.contact_hero_image_url,
    car_placeholders: [],
  };
}

/**
 * Augmenta `cars[]` v1 com campos v2 (default values seguros).
 *
 * - `category` default `'Sedan'` (fallback comercialmente seguro).
 * - `photos` populated de `gallery_urls` se existir, senão `[thumbnail_url]`
 *   3x (atende min(3) do schema).
 * - `plates_visible: false` literal (legal compliance).
 */
function augmentCars(cars: SiteVariablesV1["cars"]): SiteCar[] {
  return cars.map((car) => {
    const photos =
      car.gallery_urls && car.gallery_urls.length >= 3
        ? car.gallery_urls
        : [car.thumbnail_url, car.thumbnail_url, car.thumbnail_url];

    // Construímos o objeto sem `category` no input (Zod aplica `.default("Sedan")`),
    // mas como TS exige no shape, passamos default explícito.
    return {
      ...car,
      category: "Sedan",
      photos,
      plates_visible: false,
    } as SiteCar;
  });
}

/**
 * Migra `raw` v1 → v2 (pure function, no I/O).
 *
 * **Entrada:** unknown (NÃO `SiteVariablesV1` typed — caller pode passar
 * `lead_sites.variables` jsonb direto). Internamente `SiteVariablesV1.parse`
 * valida o input v1 antes de transformar.
 *
 * **Saída:** `SiteVariables` v2 válido (Zod-parsed).
 *
 * **Throws:** `ZodError` se input não é v1 válido.
 */
export function migrateV1ToV2(raw: unknown): SiteVariablesV2 {
  const v1 = SiteVariablesV1.parse(raw);

  const candidate = {
    // Identidade
    business_name: v1.business_name,
    business_slug: v1.business_slug,
    slogan: v1.slogan,
    // years_in_market: undefined  — não existia em v1

    // Contato
    phone_display: v1.phone_display,
    whatsapp: v1.whatsapp,
    email: v1.email,
    address: parseAddressLine(v1.address_line),
    hours: v1.hours,

    // Social
    instagram_url: v1.instagram_url,
    facebook_url: v1.facebook_url,
    youtube_url: v1.youtube_url,
    // whatsapp_url: undefined — opcional em v2

    // Visual nested
    brand_assets: buildBrandAssets(v1),

    // Conteúdo
    home_categories: v1.home_categories,
    emphasis: v1.emphasis,
    recent_sales: v1.recent_sales,

    // Sobre
    about_text: v1.about_text,
    mission: v1.mission,
    vision: v1.vision,
    values: v1.values,

    // Estoque
    cars: augmentCars(v1.cars),

    // Trust — testimonials ausente em v1

    // Metadata
    schema_version: 2 as const,
    generated_by: v1.generated_by,
    generation_version: v1.generation_version,
  };

  return SiteVariablesV2.parse(candidate);
}

// ===========================================================================
// Read (entry point para callers em rotas)
// ===========================================================================

/**
 * Lê `raw` (jsonb de `lead_sites.variables`) e retorna `SiteVariables` v2
 * válido. Faz fallback gracioso de v1 com log de auditoria.
 *
 * Estratégia:
 *   1. Tenta `SiteVariables.safeParse(raw)` (v2 primeiro).
 *   2. Se falha E `isV1(raw)` true → roda `migrateV1ToV2` → resultado v2 válido.
 *   3. Se ainda falha → throw `ZodError` original (NÃO mascarar).
 *
 * **Throws:** `ZodError` se nem v2 nem v1 parse aceitar o input.
 *
 * **Side effect:** `console.warn` quando o caminho v1 é exercido — para
 * auditoria pós-deploy. Esperado zero warns 24h após apply da migration.
 */
export function readSiteVariables(raw: unknown): SiteVariablesV2 {
  const v2Attempt = SiteVariablesV2.safeParse(raw);
  if (v2Attempt.success) return v2Attempt.data;

  if (isV1(raw)) {
    const v1Snapshot = isV1(raw) ? extractV1Audit(raw) : {};
    console.warn("[migrate-variables] v1 fallback hit", v1Snapshot);
    return migrateV1ToV2(raw);
  }

  // Nem v2 nem v1 — propaga o ZodError v2 original (mais informativo
  // sobre o shape esperado moderno).
  throw v2Attempt.error;
}

/**
 * Variante non-throwing: retorna result tagged union ao invés de throw.
 *
 * Útil em routes que querem renderizar `notFound()` ao invés de propagar
 * 500 quando `lead_sites.variables` é inconsistente.
 */
export function readSiteVariablesSafe(
  raw: unknown,
):
  | { success: true; data: SiteVariablesV2 }
  | { success: false; error: ZodError } {
  try {
    const data = readSiteVariables(raw);
    return { success: true, data };
  } catch (err) {
    // readSiteVariables só throw ZodError pelo contrato.
    return { success: false, error: err as ZodError };
  }
}

// ===========================================================================
// Helpers internos (não exportados)
// ===========================================================================

/**
 * Extrai snapshot mínimo de campos v1 para o log de auditoria — sem PII
 * sensível (telefone, email, address).
 */
function extractV1Audit(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  return {
    schema_version: obj["schema_version"] ?? null,
    has_address_line: obj["address_line"] != null,
    has_brand_assets: typeof obj["brand_assets"] === "object",
    business_slug: typeof obj["business_slug"] === "string"
      ? obj["business_slug"]
      : "<unknown>",
    cars_count: Array.isArray(obj["cars"]) ? obj["cars"].length : 0,
  };
}
