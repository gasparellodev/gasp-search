/**
 * Rota pública `/sites/[slug]/anunciar` (Phase 7 — issue #163).
 *
 * Sub-rota Anunciar. Compartilha contrato de routing com `/sites/[slug]`
 * (M2.1 / M2.3 — #160 / #162). Renderiza `<AdvertiseSection>` entre
 * Header e Footer com `activePage="anunciar"`.
 *
 * **`SiteVariables.safeParse`** antes do render — defesa em
 * profundidade contra JSON quebrado em `lead_sites.variables`.
 *
 * **`metadata.robots`**: noindex/nofollow.
 */
import "server-only";

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AdvertiseSection } from "@/components/sites/advertise/AdvertiseSection";
import { SitePage } from "@/components/sites/SitePage";
import { getSite } from "@/lib/sites/get-site";
import { SiteVariables } from "@/types/lead-site";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AnunciarPage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSite(slug);

  if (!site) notFound();
  if (site.status === "draft" || site.status === "archived") {
    notFound();
  }

  const parsed = SiteVariables.safeParse(site.variables);
  if (!parsed.success) {
    console.error("[site:render:anunciar] invalid variables", {
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
      activePage="anunciar"
    >
      <AdvertiseSection
        siteId={site.id}
        slug={site.slug}
        primary_color={parsed.data.primary_color}
        text_on_primary={parsed.data.text_on_primary}
        business_name={parsed.data.business_name}
      />
    </SitePage>
  );
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
