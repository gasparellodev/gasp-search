import "server-only";

import {
  GENERATION_MODEL,
  GENERATION_VERSION,
  type generateCopy,
} from "@/lib/sites/generate-copy";
import { slugifyVehicle } from "@/lib/sites/slug";
import { slugify } from "@/lib/utils/slug";
import type { Database } from "@/types/database";
import type { Address as AddressType, SiteCar } from "@/types/lead-site";

import type { AssetSources } from "./brand-assets.types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type SiteCopyOutput = Awaited<ReturnType<typeof generateCopy>>;

/**
 * Espelha `SiteVariablesV2.business_name.max(80)` em `types/lead-site.ts`.
 * Constante exportada pra que mudança no schema force atualização aqui.
 */
export const BUSINESS_NAME_MAX = 80;

/**
 * Fallback genérico quando uma URL no pipeline de brand assets é inválida
 * ou ausente — usado por `safeCarAt` no merge e por `sanitizeAssetUrls`
 * em `lead-site.ts`.
 */
export const FALLBACK_IMAGE_URL =
  "https://placehold.co/1024x768/0c0c0c/ffffff.png";

/**
 * `business_name` no schema (`SiteVariablesV2.business_name`) é limitado a 80
 * chars. `lead.name` vem do Apify Maps com cauda promocional ("- Venda, Troca
 * e Financiamento ..."), facilmente passando dos 80. Estratégia:
 *  1. Trim + colapsa whitespace.
 *  2. Se ainda > 80, corta no primeiro separador natural (`|`, `-`, `(`, `:`,
 *     `,`, `.`) — preserva o head canônico da concessionária.
 *  3. Se ainda > 80 (sem separador), hard-truncate em 80 com ellipsis.
 *
 * Pure — não toca DB nem env. Testes não precisam de mocks.
 */
export function clampBusinessName(input: string): string {
  const collapsed = input.replace(/\s+/g, " ").trim();
  if (collapsed.length <= BUSINESS_NAME_MAX) return collapsed;

  for (const sep of [" | ", " - ", " (", ": ", ", ", ". "]) {
    const idx = collapsed.indexOf(sep);
    if (idx > 0 && idx <= BUSINESS_NAME_MAX) {
      const head = collapsed.slice(0, idx).trim();
      if (head.length > 0) return head;
    }
  }

  return `${collapsed.slice(0, BUSINESS_NAME_MAX - 1).trimEnd()}…`;
}

/**
 * Constrói o sub-objeto `Address` best-effort a partir do lead.
 *
 * `Address` em v2 exige `street`, `number`, `neighborhood`, `city`, `state`,
 * `zip` com `min(1)` cada (state é UF /^[A-Z]{2}$/; zip é /^\d{5}-?\d{3}$/).
 * Como `Lead` do Apify Maps em geral só tem `city`/`state`, **best-effort
 * fail = retornar `null`** (Address é `.nullable()` no v2). Isso evita
 * crash em `SiteVariablesV2.parse(merged)`.
 *
 * Critério: retorna `null` se qualquer um dos 6 campos obrigatórios
 * ficar vazio depois das tentativas.
 *
 * Exportado para reuso em testes diretos.
 */
export function buildAddressFromLead(lead: Lead): AddressType | null {
  const city = (lead.city ?? "").trim();
  const stateRaw = (lead.state ?? "").trim();
  const state = stateRaw.toUpperCase();

  // Sem city/state nem tentar — não tem como montar Address válido.
  if (city.length === 0 || !/^[A-Z]{2}$/.test(state)) {
    return null;
  }

  // V1: ainda não temos street/number/neighborhood/zip estruturados no lead.
  // Retornar `null` mantém o write path correto — admin completa via modal.
  // (Quando #197 follow-up "F-AddressEnrichment" chegar, parseamos
  // `lead.address_line` aqui.)
  return null;
}

/**
 * Constrói `cars[]` v2 a partir do copy IA + assets. Cada carro recebe:
 *  - `category: 'Sedan'` default (heurística real é follow-up — V1 placeholder).
 *  - `photos[]` length 3 derivado de `car_placeholders` (cíclico).
 *  - `plates_visible: false` literal (compliance).
 *  - `thumbnail_url`/`gallery_urls` mantidos (backward-compat — `SiteCar`
 *    ainda exige).
 *
 * O gerador continua emitindo 4–6 entries via SiteCopy; o schema público
 * aceita estoque maior desde #225 para páginas paginadas.
 */
function buildCars(
  copy: SiteCopyOutput,
  businessName: string,
  carUrls: string[],
): SiteCar[] {
  const safeCarAt = (i: number): string =>
    carUrls[i] ?? carUrls[0] ?? FALLBACK_IMAGE_URL;

  return copy.cars.map((c, idx) => {
    const brand = businessName.split(" ")[0] ?? "Carro";
    const model = `Modelo ${idx + 1}`;
    const year = new Date().getFullYear() - (idx % 3);
    const deterministicId = `${idx + 1}${idx + 1}${idx + 1}${idx + 1}`;
    const galleryAndPhotos = [
      safeCarAt(idx % Math.max(1, carUrls.length)),
      safeCarAt((idx + 1) % Math.max(1, carUrls.length)),
      safeCarAt((idx + 2) % Math.max(1, carUrls.length)),
    ];
    return {
      slug: slugifyVehicle({ brand, model, year, id: deterministicId }),
      brand,
      model,
      year,
      km: idx * 12_000,
      price: null,
      transmission: "Automático" as const,
      fuel: "Flex" as const,
      color: "Branco",
      description: c.description,
      thumbnail_url: safeCarAt(idx + 4 < carUrls.length ? idx + 4 : idx),
      gallery_urls: galleryAndPhotos,
      photos: galleryAndPhotos,
      datasheet: c.datasheet,
      featured: c.featured,
      category: "Sedan" as const,
      plates_visible: false as const,
    };
  });
}

/**
 * Compõe `SiteVariablesV2` a partir do lead, brand assets e copy IA.
 * Retorna `unknown` porque o schema final é validado em `lead-site.ts` via
 * `SiteVariablesV2.parse(merged)` — manter aqui plain object permite testar
 * o merge sem acoplar ao schema.
 *
 * **Shape v2 (issue #197):**
 *  - Identidade: `business_name` (clamped), `business_slug`, `slogan`,
 *    `schema_version: 2`.
 *  - Contato: `phone_display`, `whatsapp`, `email`, `address` (nested
 *    via `buildAddressFromLead` — null permitido), `hours`.
 *  - Social: `instagram_url`, `facebook_url`, `youtube_url`.
 *  - `brand_assets`: nested com `logo_url`, `primary_color`, `text_on_primary`,
 *    `hero_image_url`, `about_image_url`, `contact_image_url` (renomeado
 *    de `contact_hero_image_url` v1), `car_placeholders` (até 6).
 *  - Conteúdo: `home_categories`, `emphasis`, `recent_sales`, `about_text`,
 *    `mission`, `vision`, `values`.
 *  - `cars[]` v2: cada item com `category`, `photos[]`, `plates_visible: false`.
 *  - Metadata: `schema_version: 2`, `generated_by`, `generation_version`.
 */
export function mergeSiteVariables(
  lead: Lead,
  assets: AssetSources,
  copy: SiteCopyOutput,
): unknown {
  const businessName = clampBusinessName(lead.name);
  const businessSlug = slugify(businessName);

  const whatsappDigitsRaw = (lead.whatsapp ?? lead.phone ?? "").replace(
    /\D/g,
    "",
  );
  const whatsappDigits =
    whatsappDigitsRaw.length > 13
      ? whatsappDigitsRaw.slice(-13)
      : whatsappDigitsRaw;
  const phoneDisplay = lead.phone ?? lead.whatsapp ?? "";

  const instagramUrl =
    lead.instagram_handle && lead.instagram_handle.length > 0
      ? `https://instagram.com/${lead.instagram_handle.replace(/^@/, "")}`
      : null;

  const carUrls = assets.car_placeholder_urls;
  const safeCarAt = (i: number): string =>
    carUrls[i] ?? carUrls[0] ?? FALLBACK_IMAGE_URL;

  // `car_placeholders` em `brand_assets`: até 6 (schema `.max(6)`).
  // Tomamos os primeiros 6 únicos via cap.
  const carPlaceholders = carUrls.slice(0, 6);

  return {
    // Identidade
    business_name: businessName,
    business_slug: businessSlug,
    slogan: copy.slogan,

    // Contato
    phone_display: phoneDisplay,
    whatsapp: whatsappDigits,
    email: lead.email,
    address: buildAddressFromLead(lead),
    hours: null,

    // Social
    instagram_url: instagramUrl,
    facebook_url: null,
    youtube_url: null,

    // Visual
    brand_assets: {
      logo_url: assets.logo_url,
      primary_color: assets.primary_color,
      text_on_primary: assets.text_on_primary,
      hero_image_url: assets.hero_image_url,
      about_image_url: assets.about_image_url,
      contact_image_url: assets.contact_hero_image_url,
      car_placeholders: carPlaceholders,
    },

    // Conteúdo de página
    home_categories: copy.home_categories.map((c, i) => ({
      label: c.label,
      image_url: safeCarAt(i),
    })),
    emphasis: {
      title: copy.emphasis.title,
      car_name: `${businessName.split(" ")[0] ?? "Modelo"} Destaque`,
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
    mission: copy.mission,
    vision: copy.vision,
    values: copy.values,

    // Estoque
    cars: buildCars(copy, businessName, carUrls),

    // Metadata
    schema_version: 2 as const,
    generated_by: GENERATION_MODEL,
    generation_version: GENERATION_VERSION,
  };
}
