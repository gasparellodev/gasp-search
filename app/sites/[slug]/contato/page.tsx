/**
 * Rota pública `/sites/[slug]/contato` (Phase 7 — issue #163).
 *
 * Sub-rota Contato. Compartilha contrato de routing com `/sites/[slug]`
 * (M2.1 / M2.3 — #160 / #162). Renderiza `<ContactSection>` entre
 * Header e Footer com `activePage="contato"`.
 *
 * **`SiteVariables.safeParse`** antes do render — defesa em
 * profundidade contra JSON quebrado em `lead_sites.variables`.
 *
 * **`generateMetadata` dinâmico (#165)**: title + OG/Twitter via
 * `buildSiteMetadata` no happy path; fallback `noindex/nofollow` puro
 * preservado em todos os caminhos.
 */
import "server-only";

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ContactSection } from "@/components/sites/contact/ContactSection";
import { SitePage } from "@/components/sites/SitePage";
import { SiteSchema } from "@/components/sites/seo/SiteSchema";
import { getSite } from "@/lib/sites/get-site";
import { buildSiteMetadata } from "@/lib/sites/metadata";
import { readSiteVariablesSafe } from "@/lib/sites/migrate-variables";
import { env } from "@/lib/env";
import { buildBreadcrumbSchema } from "@/lib/sites/schema";

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
    pageLabel: "Contato",
    site,
    pathname: "/contato",
    route: { kind: "contato" },
  });
}

export default async function ContatoPage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSite(slug);

  if (!site) notFound();
  if (site.status === "draft" || site.status === "archived") {
    notFound();
  }

  const parsed = readSiteVariablesSafe(site.variables);
  if (!parsed.success) {
    console.error("[site:render:contato] invalid variables", {
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
    { name: "Contato", item: `${siteUrl}/contato` },
  ]);

  return (
    <SitePage
      variables={parsed.data}
      siteId={site.id}
      slug={site.slug}
      activePage="contato"
    >
      <SiteSchema schemas={breadcrumbSchema} />
      <ContactSection
        variables={parsed.data}
        siteId={site.id}
        slug={site.slug}
      />
    </SitePage>
  );
}
