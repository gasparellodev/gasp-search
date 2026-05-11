/**
 * Rota pública `/sites/[slug]/estoque` (Phase 7 — issue #164).
 *
 * Lista de carros do estoque com filtro client-side sincronizado na URL.
 * Compartilha contrato de routing com `/sites/[slug]` (#160) e demais
 * sub-rotas (#163):
 *   - `null` (slug missing) → `notFound()`.
 *   - `draft` / `archived` → `notFound()`.
 *   - `published` / `sent` → renderiza `<SitePage activePage="estoque">`
 *     com `<StockSection>` injetado entre Header e Footer.
 *
 * **Filtro #224 / E1**: `parseStockFilters` preserva short keys canônicas
 * (`m`, `model`, `c`, `pmin`...) e passthrough (`sort`, `page`) para o #225.
 *
 * **`SiteVariables.safeParse`** antes do render — defesa em
 * profundidade contra JSON quebrado em `lead_sites.variables`.
 *
 * **`generateMetadata` dinâmico (#165)**: title `${business_name} —
 * Estoque`, OG/Twitter via `buildSiteMetadata` no happy path; fallback
 * `noindex/nofollow` puro preservado em todos os caminhos. Ignoramos
 * `searchParams.categoria` no metadata — title da listagem é estático
 * por filtro pra evitar duplicate-content sinaler em SERP (mesmo com
 * noindex; defesa em camadas).
 */
import "server-only";

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SitePage } from "@/components/sites/SitePage";
import { StockSection } from "@/components/sites/stock/StockSection";
import { SiteSchema } from "@/components/sites/seo/SiteSchema";
import { env } from "@/lib/env";
import { buildBreadcrumbSchema } from "@/lib/sites/schema";
import { getSite } from "@/lib/sites/get-site";
import { buildSiteMetadata } from "@/lib/sites/metadata";
import { readSiteVariablesSafe } from "@/lib/sites/migrate-variables";
import { parseStockFilters } from "@/lib/sites/stock-search-params";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const NOINDEX_FALLBACK: Metadata = {
  robots: { index: false, follow: false },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSite(slug);
  if (!site) return NOINDEX_FALLBACK;
  if (site.status === "draft" || site.status === "archived") {
    return NOINDEX_FALLBACK;
  }
  const parsed = readSiteVariablesSafe(site.variables);
  if (!parsed.success) return NOINDEX_FALLBACK;
  return buildSiteMetadata({
    variables: parsed.data,
    pageLabel: "Estoque",
    site,
    pathname: "/estoque",
    route: { kind: "estoque" },
  });
}

export default async function EstoquePage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const rawSearchParams = await searchParams;
  const site = await getSite(slug);

  if (!site) notFound();
  if (site.status === "draft" || site.status === "archived") {
    notFound();
  }

  const parsed = readSiteVariablesSafe(site.variables);
  if (!parsed.success) {
    console.error("[site:render:estoque] invalid variables", {
      slug,
      issuePaths: parsed.error.issues.map((i) => i.path.join(".")),
    });
    notFound();
  }

  const initialFilters = parseStockFilters(rawSearchParams);

  // BreadcrumbList per-page (sitewide graph fica no layout).
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const siteUrl = `${baseUrl}/sites/${site.slug}`;
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Início", item: siteUrl },
    { name: "Estoque", item: `${siteUrl}/estoque` },
  ]);

  return (
    <SitePage
      variables={parsed.data}
      siteId={site.id}
      slug={site.slug}
      activePage="estoque"
    >
      <SiteSchema schemas={breadcrumbSchema} />
      <StockSection
        variables={parsed.data}
        initialFilters={initialFilters}
        slug={site.slug}
      />
    </SitePage>
  );
}
