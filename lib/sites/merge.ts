import "server-only";

import {
  GENERATION_MODEL,
  GENERATION_VERSION,
  type generateCopy,
} from "@/lib/sites/generate-copy";
import { slugify } from "@/lib/utils/slug";
import type { Database } from "@/types/database";

import type { AssetSources } from "./brand-assets.types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type SiteCopyOutput = Awaited<ReturnType<typeof generateCopy>>;

/**
 * Espelha `SiteVariables.business_name.max(80)` em `types/lead-site.ts`.
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
 * `business_name` no schema (`SiteVariables.business_name`) é limitado a 80
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
 * Compõe `SiteVariables` final a partir do lead, brand assets e copy IA.
 * Retorna `unknown` porque o schema final é validado em `lead-site.ts` via
 * `SiteVariables.parse(merged)` — manter aqui plain object permite testar
 * o merge sem acoplar ao schema.
 *
 * Campos derivados de cada fonte:
 *  - Lead: `business_name` (clamped), `business_slug`, `whatsapp` (digits-only,
 *          clamped a 13 chars), `phone_display`, `email`, `instagram_url`,
 *          `address_line`.
 *  - Assets: `logo_url`, `primary_color`, `text_on_primary`, hero/about/contact
 *           images, `car_placeholder_urls` (pra `home_categories.image_url`,
 *           `emphasis.image_url`, `recent_sales[].image_url` e `cars[].thumbnail_url`).
 *  - Copy: `slogan`, `home_categories[].label`, `emphasis.{title,description}`,
 *          `about_text`, `mission`, `vision`, `values`, `cars[].{description,...}`.
 *  - Constantes: `generated_by`, `generation_version`.
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

  const cityState = [lead.city, lead.state].filter(Boolean).join(", ");
  const addressLine = cityState.length > 0 ? cityState : null;

  const carUrls = assets.car_placeholder_urls;
  const safeCarAt = (i: number): string =>
    carUrls[i] ?? carUrls[0] ?? FALLBACK_IMAGE_URL;

  const fullCars = copy.cars.map((c, idx) => ({
    slug: `car-${idx + 1}`,
    brand: businessName.split(" ")[0] ?? "Carro",
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

    hero_image_url: assets.hero_image_url,
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

    about_text: copy.about_text,
    about_image_url: assets.about_image_url,
    mission: copy.mission,
    vision: copy.vision,
    values: copy.values,

    contact_hero_image_url: assets.contact_hero_image_url,

    cars: fullCars,

    generated_by: GENERATION_MODEL,
    generation_version: GENERATION_VERSION,
  };
}
