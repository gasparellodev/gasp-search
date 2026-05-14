/**
 * Rota pública `/sites/[slug]/sobre` (Phase 7 — issue #163).
 *
 * Sub-rota da Sobre. Compartilha 100% do contrato de routing com
 * `/sites/[slug]` (M2.1 / M2.3 — #160 / #162):
 *   - `null` (slug missing) → `notFound()`.
 *   - `draft` / `archived` → `notFound()`.
 *   - `published` / `sent` → renderiza `<SitePage activePage="sobre">`
 *     com sections About + Home H3 reutilizadas entre Header e Footer.
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

import { AboutHeroEditorial } from "@/components/sites/about/AboutHeroEditorial";
import { AboutMissionVision } from "@/components/sites/about/AboutMissionVision";
import { AboutWarrantyDeepdive } from "@/components/sites/about/AboutWarrantyDeepdive";
import { HomeContactFormQuick } from "@/components/sites/home/HomeContactFormQuick";
import { HomeGoogleReviewsEmbed } from "@/components/sites/home/HomeGoogleReviewsEmbed";
import { SiteSchema } from "@/components/sites/seo/SiteSchema";
import { env } from "@/lib/env";
import { buildBreadcrumbSchema } from "@/lib/sites/schema";
import { SitePage } from "@/components/sites/SitePage";
import { resolveVisualIdentity } from "@/lib/sites/default-visual-identity";
import { getSite } from "@/lib/sites/get-site";
import { buildSiteMetadata } from "@/lib/sites/metadata";
import { readSiteVariablesSafe } from "@/lib/sites/migrate-variables";

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
  const parsed = readSiteVariablesSafe(site.variables);
  if (!parsed.success) return NOINDEX_FALLBACK;
  return buildSiteMetadata({
    variables: parsed.data,
    pageLabel: "Sobre nós",
    site,
    pathname: "/sobre",
    route: { kind: "sobre" },
  });
}

export default async function SobrePage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSite(slug);

  if (!site) notFound();
  if (site.status === "draft" || site.status === "archived") {
    notFound();
  }

  const parsed = readSiteVariablesSafe(site.variables);
  if (!parsed.success) {
    console.error("[site:render:sobre] invalid variables", {
      slug,
      issuePaths: parsed.error.issues.map((i) => i.path.join(".")),
    });
    notFound();
  }

  // BreadcrumbList per-page (sitewide graph fica no layout).
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const siteUrl = `${baseUrl}/sites/${site.slug}`;
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Início", item: siteUrl },
    { name: "Sobre nós", item: `${siteUrl}/sobre` },
  ]);

  return (
    <SitePage
      variables={parsed.data}
      siteId={site.id}
      slug={site.slug}
      activePage="sobre"
      manifest={resolveVisualIdentity(site.visual_identity)}
      rating={site.lead_rating}
      reviewsCount={site.lead_reviews_count}
    >
      <SiteSchema schemas={breadcrumbSchema} />
      <AboutHeroEditorial
        variables={parsed.data}
        manifestAboutUrl={resolveVisualIdentity(site.visual_identity).about_url}
      />
      <AboutMissionVision variables={parsed.data} />
      <AboutWarrantyDeepdive />
      <HomeGoogleReviewsEmbed
        rating={site.lead_rating}
        reviewsCount={site.lead_reviews_count}
        primary_color={parsed.data.brand_assets.primary_color}
      />
      <HomeContactFormQuick
        siteId={site.id}
        businessName={parsed.data.business_name}
        slug={site.slug}
      />
    </SitePage>
  );
}
