/**
 * `types/visual-identity.ts`
 *
 * Schema Zod canônico para `lead_sites.visual_identity` (issue #215).
 *
 * Foundation pra Sprint 2 #A2 (#216 — generateVisualIdentity action):
 * a action persiste um `VisualIdentityManifest` em `lead_sites.visual_identity`
 * (coluna JSONB criada em `supabase/migrations/0019_lead_sites_visual_identity.sql`).
 *
 * Fonte canônica: DESIGN.md §"Per-client visual identity contract" +
 * issue #215 (refined PO). Shape mínimo V1 — campos podem ser
 * adicionados em #216 (ex.: per-asset cost, prompt versions) sem
 * breaking change desde que sejam `.optional()`.
 *
 * Convenção de URL: aceita absolute URL (http/https) ou caminho
 * absoluto local (`/...`). Mesmo pattern de `imageUrlOrPath` em
 * `types/lead-site.ts` (DRY entre os schemas do Site Generator).
 */

import { z } from "zod";

/**
 * URL de imagem aceita pelo manifest. Pode ser:
 *   - Absolute URL (`http(s)://...`) — caso clássico (Supabase Storage
 *     CDN, Vercel Blob).
 *   - Caminho absoluto local (`/assets/...`) — fallback quando admin
 *     hospeda manualmente em `public/assets/`.
 *
 * Reproduz o pattern de `types/lead-site.ts:imageUrlOrPath` sem
 * compartilhar implementação (manter os schemas independentes — cada
 * área pode evoluir validações sem cross-contamination).
 */
const imageUrlOrPath = z
  .string()
  .min(1)
  .refine(
    (val) => /^https?:\/\//i.test(val) || val.startsWith("/"),
    { message: "Must be absolute URL (http/https) or absolute path (/...)." },
  );

/**
 * Modelos de geração de imagem suportados em V1.
 *
 * - `gpt-image-2-2026-04-21`: snapshot pinado do modelo OpenAI default
 *   (#216 spike). Pinned date para builds reproduzíveis — `gpt-image-2`
 *   sem snapshot pode receber mudanças silenciosas.
 * - `gpt-image-1-mini`: fallback automático caso `gpt-image-2` retorne
 *   erro persistente (não-retryable). **DALL-E 3 NÃO é fallback** —
 *   modelo será deprecado 2026-05-12 (#216 PO refinement).
 *
 * Discrim union — quando models adicionais entrarem, manter
 * snapshot-date format pra reprodutibilidade.
 */
export const VisualIdentityModelSchema = z.enum([
  "gpt-image-2-2026-04-21",
  "gpt-image-1-mini",
]);
export type VisualIdentityModel = z.infer<typeof VisualIdentityModelSchema>;

/**
 * `VisualIdentityManifestSchema` — shape persistido em
 * `lead_sites.visual_identity` (JSONB).
 *
 * Fields (7):
 *   - `hero_url` — banner principal da home.
 *   - `categories_urls[]` — banners de categorias (até 6 — corresponde
 *     às 6 categorias em `SiteCar.category`: SUV, Sedan, Hatch, Pickup,
 *     Esportivo, Conversível). Mínimo 1 (admin pode regenerar 1 por vez).
 *   - `about_url` — hero da página /sites/[slug]/sobre.
 *   - `contact_url` — hero da página /sites/[slug]/contato.
 *   - `generated_at` — ISO timestamp da última geração (server-side).
 *   - `model` — modelo usado (`gpt-image-2` ou `dall-e-3`).
 *   - `cost_estimate_brl` — custo estimado em BRL (não-negativo).
 */
export const VisualIdentityManifestSchema = z.object({
  hero_url: imageUrlOrPath,
  categories_urls: z.array(imageUrlOrPath).min(1).max(6),
  about_url: imageUrlOrPath,
  contact_url: imageUrlOrPath,
  generated_at: z.string().datetime({ offset: true }),
  model: VisualIdentityModelSchema,
  cost_estimate_brl: z.number().nonnegative(),
});
export type VisualIdentityManifest = z.infer<
  typeof VisualIdentityManifestSchema
>;
