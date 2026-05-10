/**
 * Schemas Zod canônicos para `lead_sites.variables` (issues #154, #197).
 *
 * **Schema versionado.** Este arquivo expõe TWO schemas:
 *   - `SiteVariablesV1` — shape flat original (issue #154). Mantido apenas
 *     como input para `lib/sites/migrate-variables.ts:migrateV1ToV2`.
 *     Não usar diretamente em código novo.
 *   - `SiteVariables` (v2 canônico, issue #197) — shape nested com
 *     `brand_assets` + `address` + `testimonials` + `schema_version: 2`
 *     discriminator. Toda persistência nova grava v2.
 *
 * Fonte canônica original: §4 do spec mestre
 * (`docs/superpowers/specs/2026-05-08-gerador-sites-concessionarias-design.md`,
 * linhas 106–180). Refinos v2 vêm de:
 *   - `DESIGN.md` (raiz) §"Per-client visual identity contract"
 *   - `docs/ISSUES-ROADMAP.md` §F0
 *   - PO refinement em https://github.com/gasparellodev/gasp-search/issues/197
 *
 * Migração: ver `lib/sites/migrate-variables.ts` (helper read-only) +
 * `supabase/migrations/0014a_site_variables_v2.sql` (UPDATE in-place).
 *
 * `SiteCopySchema` é o subset textual emitido pela IA per §6 — não inclui
 * brand assets, URLs ou metadata. Mantido independente.
 */

import { z } from "zod";

/**
 * URL de imagem aceita pelo Site Generator. Pode ser:
 *   - Absolute URL (`http(s)://...`) — caso clássico (Vercel Blob, Apify, CDNs).
 *   - Caminho absoluto local (`/assets/...`) — quando o admin gerencia
 *     imagens manualmente em `public/assets/` (decisão UX 2026-05-09).
 *
 * Validação:
 *   - String não-vazia.
 *   - Match em `http(s)://...` OU começa com `/`.
 *
 * NÃO usado para URLs externas obrigatórias (Instagram/Facebook/YouTube/email)
 * — essas continuam com `.url()` estrito porque precisam abrir em outro tab.
 */
const imageUrlOrPath = z
  .string()
  .min(1)
  .refine(
    (val) => /^https?:\/\//i.test(val) || val.startsWith("/"),
    { message: "Must be absolute URL (http/https) or absolute path (/...)." },
  );

// ===========================================================================
// V2 — Schemas atômicos (Address, BrandAssets, Testimonial)
// ===========================================================================

/**
 * Endereço estruturado da loja (issue #197 §A1).
 *
 * Substitui `address_line` flat de v1. Migração best-effort em
 * `migrate-variables.ts:migrateV1ToV2` — quando regex não casa retorna `null`
 * no lugar (Zod permite via wrapper `.nullable()`).
 *
 * `country: 'BR'` literal porque o produto atende apenas Brasil em V1.
 * `state` é UF de 2 letras maiúsculas (`SP`, `RJ`, etc.).
 * `zip` aceita CEP com ou sem hífen (`01310-100` ou `01310100`).
 */
export const Address = z.object({
  street: z.string().trim().min(1).max(120),
  number: z.string().trim().min(1).max(10), // "S/N" permitido
  neighborhood: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(80),
  state: z.string().regex(/^[A-Z]{2}$/),
  zip: z.string().regex(/^\d{5}-?\d{3}$/),
  country: z.literal("BR").default("BR"),
});
export type Address = z.infer<typeof Address>;

/**
 * Brand assets agrupados (issue #197 §A2).
 *
 * Em v1, esses campos viviam flat em `SiteVariables` (`primary_color`,
 * `logo_url`, `hero_image_url`, `about_image_url`,
 * `contact_hero_image_url`). v2 consolida em um sub-objeto.
 *
 * Saída do pipeline `lib/sites/brand-assets.ts:extractBrandAssets`. Garante:
 *   - `primary_color` regex `^#[0-9a-f]{6}$/i`.
 *   - `text_on_primary` `'#FFFFFF' | '#0C0C0C'` (WCAG AA).
 *   - URLs todas via `imageUrlOrPath` (URL ou /assets/).
 *
 * `car_placeholders` é a lista de 0–6 fotos default para preencher
 * `cars[].photos[]` quando o lead não trouxer fotos reais.
 *
 * **Renomeação v1→v2:** `contact_hero_image_url` → `contact_image_url`.
 */
export const BrandAssets = z.object({
  logo_url: imageUrlOrPath,
  primary_color: z.string().regex(/^#[0-9a-f]{6}$/i),
  text_on_primary: z.enum(["#FFFFFF", "#0C0C0C"]),
  hero_image_url: imageUrlOrPath,
  about_image_url: imageUrlOrPath,
  contact_image_url: imageUrlOrPath,
  car_placeholders: z.array(imageUrlOrPath).max(6).default([]),
});
export type BrandAssets = z.infer<typeof BrandAssets>;

/**
 * Depoimento de cliente (issue #197 §A3).
 *
 * V1 hardcoded em `variables.testimonials[]`. V2 via integração Google
 * Reviews (futuro). `source: 'manual'` em V1 — IA pode gerar drafts mas
 * texto ainda é editável pelo PO.
 *
 * `author_avatar_url: null` → fallback monogram via initials (frontend).
 */
export const Testimonial = z.object({
  author_name: z.string().trim().min(1).max(80),
  author_avatar_url: imageUrlOrPath.nullable(),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(20).max(600),
  source: z.enum(["google", "instagram", "manual"]).default("manual"),
});
export type Testimonial = z.infer<typeof Testimonial>;

// ===========================================================================
// SiteCar — Estoque (extensão v1 + v2)
// ===========================================================================

/**
 * Carro do estoque. Schema **comum** entre v1 e v2 — v2 adiciona campos
 * (issue #197 §A4) preservando os existentes.
 *
 * Campos v2 NEW:
 *   - `version` — string opcional ("Sport", "Sportback Performance Black").
 *   - `doors` — 2/3/4/5 opcional.
 *   - `category` — enum obrigatório (default `Sedan` em migração).
 *   - `photos` — array URL/path (alias canônico de `gallery_urls` em V1).
 *   - `vin` — VIN regex 17 chars opcional.
 *   - `plates_visible: false` — legal compliance, sempre false em V1
 *     (placas devem ser borradas em fotos publicadas).
 *
 * Campos v1 mantidos durante transição:
 *   - `gallery_urls`, `thumbnail_url` — deprecated em F0+1; remover quando
 *     telemetry confirmar 0 reads. `photos` é o canônico em v2.
 */
export const SiteCar = z.object({
  // V1 + V2 (sempre presentes)
  slug: z.string().regex(/^[a-z0-9-]+$/),
  brand: z.string(),
  model: z.string(),
  year: z
    .number()
    .int()
    .min(1990)
    .max(new Date().getFullYear() + 1),
  km: z.number().int().min(0),
  price: z.number().positive().nullable(),
  transmission: z.enum(["Manual", "Automático", "CVT", "Outros"]),
  fuel: z.enum(["Gasolina", "Etanol", "Flex", "Diesel", "Híbrido", "Elétrico"]),
  color: z.string(),
  description: z.string().min(80).max(800),
  thumbnail_url: imageUrlOrPath,
  gallery_urls: z.array(imageUrlOrPath).min(3).max(8),
  datasheet: z.array(z.tuple([z.string(), z.string()])),
  featured: z.boolean(),

  // V2 additions (opcional/com default para retrocompat)
  version: z.string().trim().max(80).optional(),
  doors: z
    .union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
    .optional(),
  category: z
    .enum(["SUV", "Sedan", "Hatch", "Pickup", "Esportivo", "Conversível"])
    .default("Sedan"),
  /**
   * Lista canônica de fotos do veículo (issue #197 §A4). Em **v2** esperada
   * sempre presente — pode ser populada via migração a partir de
   * `gallery_urls`. **Optional** para não quebrar tests/fixtures legados
   * que ainda passam SiteCar v1 direto. Consumers devem preferir `photos`
   * e cair em `gallery_urls` apenas em fallback.
   */
  photos: z.array(imageUrlOrPath).min(3).max(8).optional(),
  vin: z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/).optional(),
  plates_visible: z.literal(false).default(false),
});
export type SiteCar = z.infer<typeof SiteCar>;

// ===========================================================================
// V1 — Schema legado (read-only, usado pela migração)
// ===========================================================================

/**
 * Shape v1 de `SiteVariables` (flat, pré-issue #197).
 *
 * **Não usar em código novo.** Somente:
 *   - `lib/sites/migrate-variables.ts:isV1` — discriminação.
 *   - `lib/sites/migrate-variables.ts:migrateV1ToV2` — input do migrator.
 *
 * Diferenças vs v2:
 *   - Brand assets flat (`primary_color`, `text_on_primary`, `logo_url`,
 *     `hero_image_url`, `about_image_url`, `contact_hero_image_url`).
 *   - `address_line: string | null` flat (sem city/state/zip).
 *   - Sem `testimonials`, `years_in_market`.
 *   - Sem `schema_version`.
 */
export const SiteVariablesV1 = z.object({
  // Globais
  business_name: z.string().min(1).max(80),
  business_slug: z.string().regex(/^[a-z0-9-]+$/),
  slogan: z.string().min(10).max(120),
  primary_color: z.string().regex(/^#[0-9a-f]{6}$/i),
  text_on_primary: z.enum(["#FFFFFF", "#0C0C0C"]),
  logo_url: imageUrlOrPath,
  whatsapp: z.string().regex(/^\d{10,13}$/),
  phone_display: z.string(),
  email: z.string().email().nullable(),
  instagram_url: z.string().url().nullable(),
  facebook_url: z.string().url().nullable(),
  youtube_url: z.string().url().nullable(),
  address_line: z.string().nullable(),
  hours: z.string().nullable(),

  // Home
  hero_image_url: imageUrlOrPath,
  home_categories: z
    .array(
      z.object({
        label: z.string().min(2).max(30),
        image_url: imageUrlOrPath,
      }),
    )
    .length(3),
  emphasis: z.object({
    title: z.string(),
    car_name: z.string(),
    description: z.string().min(50).max(400),
    image_url: imageUrlOrPath,
  }),
  recent_sales: z
    .array(
      z.object({
        car_name: z.string(),
        image_url: imageUrlOrPath,
      }),
    )
    .length(3),

  // Sobre
  about_text: z.string().min(200).max(1500),
  about_image_url: imageUrlOrPath,
  mission: z.string().min(40).max(200),
  vision: z.string().min(40).max(200),
  values: z.array(z.string().min(8).max(80)).min(4).max(8),

  // Contato
  contact_hero_image_url: imageUrlOrPath,

  // Estoque
  cars: z.array(SiteCar).min(4).max(6),

  // Metadata
  generated_by: z.literal("claude-sonnet-4-6"),
  generation_version: z.string(),
});
export type SiteVariablesV1 = z.infer<typeof SiteVariablesV1>;

// ===========================================================================
// V2 — Schema canônico (usado em todo código novo)
// ===========================================================================

/**
 * `SiteVariables` v2 (issue #197 §A5).
 *
 * Shape nested com `brand_assets` + `address` consolidados, `testimonials`
 * opcional, e `schema_version: 2` como discriminator.
 *
 * **Toda escrita em `lead_sites.variables` deve persistir v2.** Reads
 * passam por `lib/sites/migrate-variables.ts:readSiteVariables` que faz
 * fallback gracioso de v1 (read-only — não persiste).
 */
export const SiteVariables = z.object({
  // Identidade
  business_name: z.string().min(1).max(80),
  business_slug: z.string().regex(/^[a-z0-9-]+$/),
  slogan: z.string().min(10).max(120).optional(),
  years_in_market: z.number().int().min(0).max(120).optional(),

  // Contato
  phone_display: z.string().min(8).max(20),
  whatsapp: z.string().regex(/^\d{10,13}$/),
  email: z.string().email().nullable(),
  address: Address.nullable(),
  hours: z.string().max(240).nullable(),

  // Social
  instagram_url: z.string().url().nullable(),
  facebook_url: z.string().url().nullable(),
  youtube_url: z.string().url().nullable(),
  whatsapp_url: z.string().url().nullable().optional(),

  // Visual
  brand_assets: BrandAssets,

  // Conteúdo de página (mantido v1)
  home_categories: z
    .array(
      z.object({
        label: z.string().min(2).max(30),
        image_url: imageUrlOrPath,
      }),
    )
    .length(3),
  emphasis: z.object({
    title: z.string(),
    car_name: z.string(),
    description: z.string().min(50).max(400),
    image_url: imageUrlOrPath,
  }),
  recent_sales: z
    .array(
      z.object({
        car_name: z.string(),
        image_url: imageUrlOrPath,
      }),
    )
    .length(3),

  // Sobre
  about_text: z.string().min(200).max(1500),
  mission: z.string().min(40).max(200),
  vision: z.string().min(40).max(200),
  values: z.array(z.string().min(8).max(80)).min(4).max(8),

  // Estoque
  cars: z.array(SiteCar).min(4).max(6),

  // Trust
  testimonials: z.array(Testimonial).max(8).optional(),

  // Metadata
  schema_version: z.literal(2),
  generated_by: z.literal("claude-sonnet-4-6"),
  generation_version: z.string(),
});
export type SiteVariables = z.infer<typeof SiteVariables>;

// ===========================================================================
// SiteCopy — subset textual emitido pela IA (per §6 do spec)
// ===========================================================================

/**
 * Reproduz EXATAMENTE as constraints de `SiteVariables` para os campos
 * compartilhados. Schema independente (não `.pick()`) porque a estrutura
 * `cars[]` é diferente — IA só emite description/datasheet/featured, sem
 * year/km/price/etc.
 *
 * `SiteCopySchema` permanece igual entre v1 e v2 — IA continua emitindo
 * apenas copy textual; brand assets/cars metadata vêm do brand-pipeline /
 * lead inputs.
 */
export const SiteCopyCar = z.object({
  description: z.string().min(80).max(800),
  datasheet: z.array(z.tuple([z.string(), z.string()])),
  featured: z.boolean(),
});
export type SiteCopyCar = z.infer<typeof SiteCopyCar>;

export const SiteCopySchema = z.object({
  slogan: z.string().min(10).max(120),
  home_categories: z
    .array(
      z.object({
        label: z.string().min(2).max(30),
      }),
    )
    .length(3),
  emphasis: z.object({
    title: z.string(),
    description: z.string().min(50).max(400),
  }),
  about_text: z.string().min(200).max(1500),
  mission: z.string().min(40).max(200),
  vision: z.string().min(40).max(200),
  values: z.array(z.string().min(8).max(80)).min(4).max(8),
  cars: z.array(SiteCopyCar).min(4).max(6),
});
export type SiteCopy = z.infer<typeof SiteCopySchema>;
