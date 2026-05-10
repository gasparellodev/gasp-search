/**
 * Rota pública `/sites/[slug]/sobre` (Phase 7 — issue #163).
 *
 * Sub-rota da Sobre. Compartilha 100% do contrato de routing com
 * `/sites/[slug]` (M2.1 / M2.3 — #160 / #162):
 *   - `null` (slug missing) → `notFound()`.
 *   - `draft` / `archived` → `notFound()`.
 *   - `published` / `sent` → renderiza `<SitePage activePage="sobre">`
 *     com `<AboutSection>` injetado entre Header e Footer.
 *
 * `getSite` vem de `lib/sites/get-site.ts` (extraído em #163) e mantém
 * `'use cache' + cacheTag('site:<slug>') + cacheLife({revalidate:3600,
 * expire:86400})`. Invalidação compartilhada com a Home — uma chamada
 * de `updateTag('site:<slug>')` no Server Action de regen invalida
 * todas as sub-rotas do site.
 *
 * **`SiteVariables.safeParse`** antes do render — defesa em
 * profundidade contra JSON quebrado em `lead_sites.variables`.
 *
 * **`generateMetadata` dinâmico (#165)**: title `${business_name} —
 * Sobre nós`, description vinda do slogan (≥40 chars) ou fallback, OG
 * image em `logo_url`, Twitter `summary_large_image`. Fallback paths
 * retornam apenas `{ robots: noindex }` — `noindex/nofollow` PRESERVADO
 * em todos os caminhos.
 */
import "server-only";

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AboutSection } from "@/components/sites/about/AboutSection";
import { SitePage } from "@/components/sites/SitePage";
import { getSite } from "@/lib/sites/get-site";
import { buildSiteMetadata } from "@/lib/sites/metadata";
import { SiteVariables } from "@/types/lead-site";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const NOINDEX_FALLBACK: Metadata = {
  robots: { index: false, follow: false },
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSite(slug);
  if (!site) return NOINDEX_FALLBACK;
  if (site.status === "draft" || site.status === "archived") {
    return NOINDEX_FALLBACK;
  }
  const parsed = SiteVariables.safeParse(site.variables);
  if (!parsed.success) return NOINDEX_FALLBACK;
  return buildSiteMetadata({
    variables: parsed.data,
    pageLabel: "Sobre nós",
  });
}

export default async function SobrePage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSite(slug);

  if (!site) notFound();
  if (site.status === "draft" || site.status === "archived") {
    notFound();
  }

  const parsed = SiteVariables.safeParse(site.variables);
  if (!parsed.success) {
    console.error("[site:render:sobre] invalid variables", {
      slug,
      issuePaths: parsed.error.issues.map((i) => i.path.join(".")),
    });
    notFound();
  }

  return (
    <SitePage
      variables={parsed.data}
      siteId={site.id}
      slug={site.slug}
      activePage="sobre"
    >
      <AboutSection variables={parsed.data} />
    </SitePage>
  );
}
