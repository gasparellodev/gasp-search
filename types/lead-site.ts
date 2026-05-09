/**
 * Schemas Zod canônicos para `lead_sites.variables` (issue #154).
 *
 * Fonte canônica: §4 do spec mestre
 * (`docs/superpowers/specs/2026-05-08-gerador-sites-concessionarias-design.md`,
 * linhas 106–180). Reproduzido **verbatim** — qualquer mudança vira PR de spec
 * primeiro, depois schema.
 *
 * Usado por:
 *   - `lib/sites/generate-copy.ts` (issue #158) — valida saída da IA via
 *     `SiteCopySchema.parse(toolUse.input)`.
 *   - `lib/sites/generate-lead-site.ts` (issue #159) — valida `variables`
 *     completo antes de persistir.
 *   - `app/sites/[slug]/page.tsx` (M2) — valida `variables` lido do banco antes
 *     de renderizar `<SitePage>`.
 *
 * `SiteCopySchema` é definido como schema **independente** (não `.pick()` de
 * `SiteVariables`) — só inclui os campos que a IA emite per §6 do spec.
 * Brand assets (cores, logo), URLs, lead metadata (whatsapp, address) e
 * variáveis fixas (year, km, price, recent_sales, text_on_primary) ficam de
 * fora porque vêm do brand-pipeline / lead, não da IA.
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

// ---------------------------------------------------------------------------
// Estoque (carros)
// ---------------------------------------------------------------------------

export const SiteCar = z.object({
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
});
export type SiteCar = z.infer<typeof SiteCar>;

// ---------------------------------------------------------------------------
// SiteVariables — payload completo persistido em `lead_sites.variables`
// ---------------------------------------------------------------------------

export const SiteVariables = z.object({
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
export type SiteVariables = z.infer<typeof SiteVariables>;

// ---------------------------------------------------------------------------
// SiteCopy — subset textual emitido pela IA (per §6 do spec)
// ---------------------------------------------------------------------------
//
// Reproduz EXATAMENTE as constraints de `SiteVariables` para os campos
// compartilhados. Schema independente (não `.pick()`) porque a estrutura
// `cars[]` é diferente — IA só emite description/datasheet/featured, sem
// year/km/price/etc.
//

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
