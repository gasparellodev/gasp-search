/**
 * `app/sites/[slug]/sitemap.ts` — Next.js Metadata file que gera o
 * `sitemap.xml` por site (`/sites/<slug>/sitemap.xml`).
 *
 * Issue #S2 — per-site sitemap como complemento ao sitemap global (#S1).
 *
 * **Rotas estáticas (6):**
 *   - `/sites/<slug>`          — Home      (priority 1.0, weekly)
 *   - `/sites/<slug>/sobre`    — Sobre nós (priority 0.7, weekly)
 *   - `/sites/<slug>/contato`  — Contato   (priority 0.7, weekly)
 *   - `/sites/<slug>/anunciar` — Anunciar  (priority 0.7, weekly)
 *   - `/sites/<slug>/estoque`  — Estoque   (priority 0.7, weekly)
 *   - `/sites/<slug>/lgpd`     — LGPD      (priority 0.7, weekly)
 *
 * **Rotas dinâmicas:**
 *   - `/sites/<slug>/estoque/<carSlug>` — Uma entrada por carro em
 *     `variables.cars[]` (priority 0.6, weekly). Cars vivem no JSONB
 *     `lead_sites.variables` — não há tabela `cars` separada no banco.
 *     Em parse failure de `SiteVariablesV2`, emite `console.warn` + mantém
 *     as 6 rotas estáticas (graceful degradation idêntica ao sitemap global).
 *
 * **Gate `isIndexable` (privacy by obscurity):**
 *   - Site `null`/`draft`/`archived` ou `signed_at IS NULL` → retorna `[]`.
 *   - Distinto do routing 404 em `page.tsx` que distingue `draft` de
 *     `archived`. Aqui todo não-publicado/não-assinado = silêncio.
 *
 * **Cache:** `export const revalidate = 3600` (ISR 1h). NÃO usa
 * `"use cache"` directive — Next Metadata files que retornam `MetadataRoute`
 * devem usar `revalidate`. A invalidação transitiva ocorre via `getSite()`
 * que internamente usa `"use cache"` + `cacheTag('site:<slug>')`.
 * Os callsites de `updateTag('site:<slug>')` em `app/actions/lead-site.ts`
 * expiram o cache de `getSite`, e o `revalidate = 3600` regenera na próxima
 * request. Padrão alinhado com `llms.txt/route.ts` (#214) e
 * `opengraph-image.tsx` (#213).
 */
import "server-only";

import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { slugifyVehicle } from "@/lib/finance";
import { getSite } from "@/lib/sites/get-site";
import { isIndexable } from "@/lib/sites/metadata";
import { SiteVariablesV2 } from "@/types/lead-site";

export const revalidate = 3600;

interface SitemapProps {
  params: Promise<{ slug: string }>;
}

/**
 * Caminhos estáticos do mini-site. String vazia = rota raiz do slug
 * (ex.: `/sites/poliguara`).
 */
const STATIC_PATHS = [
  "",
  "/sobre",
  "/contato",
  "/anunciar",
  "/estoque",
  "/lgpd",
] as const;

export default async function sitemap({
  params,
}: SitemapProps): Promise<MetadataRoute.Sitemap> {
  const { slug } = await params;
  const site = await getSite(slug);

  // Gate: site inexistente, draft, archived ou sem signed_at → silêncio.
  // Privacy by obscurity — não vazar URLs de sites não publicados/assinados.
  if (!site || !isIndexable(site)) return [];

  const base = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/sites/${slug}`;
  const lastModified = new Date((site as { updated_at?: string }).updated_at ?? Date.now());

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1.0 : 0.7,
  }));

  // Car detail URLs — extraídos de `variables.cars[]` (JSONB no banco).
  // NÃO há tabela `cars` separada; todo o estoque é payload do site.
  const parsed = SiteVariablesV2.safeParse(site.variables);
  if (!parsed.success) {
    console.warn(
      `[sites:site-sitemap] SiteVariablesV2 parse failed for slug=${slug}; skipping car detail URLs`,
    );
    return staticEntries;
  }

  const carEntries: MetadataRoute.Sitemap = parsed.data.cars.map((car) => ({
    url: `${base}/estoque/${car.slug || slugifyVehicle(car)}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...carEntries];
}
