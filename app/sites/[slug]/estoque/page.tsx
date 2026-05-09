/**
 * Rota pública `/sites/[slug]/estoque` (Phase 7 — issue #164).
 *
 * Lista de carros do estoque com filtro multi-select via `?categoria=`.
 * Compartilha contrato de routing com `/sites/[slug]` (#160) e demais
 * sub-rotas (#163):
 *   - `null` (slug missing) → `notFound()`.
 *   - `draft` / `archived` → `notFound()`.
 *   - `published` / `sent` → renderiza `<SitePage activePage="estoque">`
 *     com `<StockSection>` injetado entre Header e Footer.
 *
 * **Filtro `?categoria=`**: parsing defensivo no `<StockSection>` via
 * `parseCategoriaParam` — tokens inválidos viram no-op (lista todos).
 * Suporta multi-select via CSV (`?categoria=sedan,suv`).
 *
 * **`SiteVariables.safeParse`** antes do render — defesa em
 * profundidade contra JSON quebrado em `lead_sites.variables`.
 *
 * **`metadata.robots`**: noindex/nofollow.
 */
import "server-only";

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SitePage } from "@/components/sites/SitePage";
import { StockSection } from "@/components/sites/stock/StockSection";
import { getSite } from "@/lib/sites/get-site";
import { SiteVariables } from "@/types/lead-site";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ categoria?: string | string[] }>;
}

export default async function EstoquePage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { categoria } = await searchParams;
  const site = await getSite(slug);

  if (!site) notFound();
  if (site.status === "draft" || site.status === "archived") {
    notFound();
  }

  const parsed = SiteVariables.safeParse(site.variables);
  if (!parsed.success) {
    console.error("[site:render:estoque] invalid variables", {
      slug,
      issuePaths: parsed.error.issues.map((i) => i.path.join(".")),
    });
    notFound();
  }

  // Quando `searchParams` traz array (raro, mas Next 16 aceita), pegamos o
  // primeiro — semântica `?categoria=a&categoria=b` não é suportada V1.
  const categoriaFilter = Array.isArray(categoria) ? categoria[0] : categoria;

  return (
    <SitePage
      variables={parsed.data}
      siteId={site.id}
      slug={site.slug}
      activePage="estoque"
    >
      <StockSection
        variables={parsed.data}
        categoriaFilter={categoriaFilter ?? null}
        slug={site.slug}
      />
    </SitePage>
  );
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
