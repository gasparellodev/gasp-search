/**
 * Rota pública `/sites/<slug>/lgpd` — Política de Privacidade LGPD.
 *
 * Comportamento de routing (idêntico às demais sub-rotas):
 *   - null / draft / archived → `notFound()`.
 *   - published / sent → renderiza `<SitePage activePage="lgpd">`.
 *
 * Metadata: sempre `noindex/nofollow` — página jurídica auxiliar, não
 * landing SEO. Ver CLAUDE.md da pasta para justificativa.
 *
 * Schema: injeta `WebPage` JSON-LD via `<script type="application/ld+json">`
 * server-rendered usando `escapeJsonLd` da `lib/sites/schema`.
 *
 * Cache: `getSite` carrega `"use cache"` + `cacheTag('site:<slug>')`.
 * Invalidação transitiva via `updateTag('site:<slug>')` em
 * `app/actions/lead-site.ts`. Não usar `"use cache"` aqui (Server Component
 * com `async params` — já beneficia do cache do `getSite`).
 */
import "server-only";

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { LgpdContent } from "@/components/sites/lgpd/LgpdContent";
import { SitePage } from "@/components/sites/SitePage";
import { env } from "@/lib/env";
import { buildLgpdSections } from "@/lib/sites/lgpd-content";
import { escapeJsonLd } from "@/lib/sites/schema";
import { getSite } from "@/lib/sites/get-site";
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
  const { business_name } = parsed.data;
  return {
    title: `Política de Privacidade — ${business_name}`,
    robots: { index: false, follow: false },
  };
}

export default async function LgpdPage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getSite(slug);

  if (!site) notFound();
  if (site.status === "draft" || site.status === "archived") {
    notFound();
  }

  const parsed = readSiteVariablesSafe(site.variables);
  if (!parsed.success) {
    console.error("[site:render:lgpd] invalid variables", {
      slug,
      issuePaths: parsed.error.issues.map((i) => i.path.join(".")),
    });
    notFound();
  }

  const variables = parsed.data;
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  // Extrair city/state do address estruturado (v2) ou null.
  const city = variables.address?.city ?? null;
  const state = variables.address?.state ?? null;

  const sections = buildLgpdSections({
    business_name: variables.business_name,
    email: variables.email,
    city,
    state,
    appUrl,
    slug,
  });

  // WebPage JSON-LD — não indexável, mas AI crawlers consomem JSON-LD
  // independentemente de robots:noindex (conforme decisão PO #211).
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Política de Privacidade — ${variables.business_name}`,
    url: `${appUrl}/sites/${slug}/lgpd`,
    inLanguage: "pt-BR",
    publisher: {
      "@type": "Organization",
      name: variables.business_name,
    },
    about: {
      "@type": "Thing",
      name: "Proteção de Dados Pessoais — LGPD Lei nº 13.709/2018",
    },
  };

  return (
    <SitePage variables={variables} siteId={site.id} slug={slug} activePage="lgpd">
      {/* JSON-LD WebPage schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: escapeJsonLd(webPageSchema) }}
      />

      <LgpdContent
        sections={sections}
        businessName={variables.business_name}
      />
    </SitePage>
  );
}
