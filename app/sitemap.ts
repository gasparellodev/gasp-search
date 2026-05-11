/**
 * `app/sitemap.ts` — Next.js Metadata file `sitemap.xml`.
 *
 * Issue #212 / Sprint 1 / #S2 — SEO infra fundamental.
 *
 * Lista os mini-sites assinados via `listIndexableSites()` e expande para
 * 5 URLs estáticas por site:
 *   - `/sites/[slug]`             — Home (priority 1.0, daily)
 *   - `/sites/[slug]/estoque`     — Lista de estoque (0.9, daily)
 *   - `/sites/[slug]/sobre`       — Página sobre (0.7, monthly)
 *   - `/sites/[slug]/contato`     — Página contato (0.7, monthly)
 *   - `/sites/[slug]/anunciar`    — Formulário anuncia (0.6, monthly)
 *
 * **`/estoque/[carSlug]` fora de escopo nesta issue.** Decisão PO: V1
 * mantém só 5 URLs estáticas por site. V2 vai paginar via
 * `generateSitemaps()` quando o catalog crescer (cada site tem max 6
 * cars; com 100+ sites começa a fazer sentido cards individuais).
 *
 * **ISR via `revalidate = 3600`** (1h). Não usa `'use cache'` directive
 * — o helper `listIndexableSites` é importado direto sem cache wrapper
 * para evitar interferência cross-cache (ver comment no helper).
 *
 * **Graceful degradation.** Em erro inesperado, retorna `[]` e logga —
 * `[]` é sitemap válido (per Sitemaps Protocol) e evita 500 no crawler.
 */
import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { listIndexableSites } from "@/lib/sites/list-indexable-sites";

export const revalidate = 3600;

/**
 * Configuração das 5 rotas estáticas por site. `path` é apensado a
 * `${baseUrl}/sites/${slug}`.
 */
const STATIC_ROUTES: ReadonlyArray<{
  path: string;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly";
}> = [
  { path: "", priority: 1.0, changeFrequency: "daily" }, // Home
  { path: "/estoque", priority: 0.9, changeFrequency: "daily" },
  { path: "/sobre", priority: 0.7, changeFrequency: "monthly" },
  { path: "/contato", priority: 0.7, changeFrequency: "monthly" },
  { path: "/anunciar", priority: 0.6, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const sites = await listIndexableSites();
    const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

    const entries: MetadataRoute.Sitemap = [];
    for (const site of sites) {
      const lastModified = new Date(site.updated_at);
      for (const route of STATIC_ROUTES) {
        entries.push({
          url: `${base}/sites/${site.slug}${route.path}`,
          lastModified,
          changeFrequency: route.changeFrequency,
          priority: route.priority,
        });
      }
    }
    return entries;
  } catch (err) {
    console.error("sitemap: query failed", err);
    return [];
  }
}
