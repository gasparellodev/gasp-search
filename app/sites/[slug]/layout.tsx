import "server-only";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CookieBanner } from "@/components/sites/CookieBanner";
import { SiteSchema } from "@/components/sites/seo/SiteSchema";
import { SitesAnalytics } from "@/components/sites/SitesAnalytics";
import { WhatsAppFloatingCTA } from "@/components/sites/WhatsAppFloatingCTA";
import { publicEnv } from "@/lib/env-public";
import { getSite } from "@/lib/sites/get-site";
import { buildSitewideGraph } from "@/lib/sites/schema";
import { readSiteVariablesSafe } from "@/lib/sites/migrate-variables";

/**
 * Auto Showroom layout (issue #198 / #F1 Sprint 0, schemas em #211 / Sprint 1).
 *
 * Wrapper das rotas `/sites/[slug]/*` que aplica `data-theme="auto-showroom"`
 * para ativar os tokens premium do DESIGN.md (`globals.css` §Auto Showroom).
 *
 * **Por que data-attribute em vez de classe?** Permite seletor scoped sem
 * conflitar com o `next-themes` que já usa `class` para light/dark. O
 * `[data-theme="auto-showroom"].dark` combina os dois — dark mode do
 * template Auto Showroom é independente do dark mode do app interno.
 *
 * **Per-client theming runtime (V1, fallback hardcoded):** quando a issue
 * #197 PR-B mergear o helper `readSiteVariablesSafe` + consumer migration,
 * este layout vai injetar `--client-primary` / `--client-on-primary` via
 * inline style do `<body>` lendo de `SiteVariablesV2.brand_assets`. Por
 * enquanto, fallback para `#0a0a0a` / `#fafafa` (DESIGN.md neutral primary).
 *
 * Nota: como `<body>` está no root layout (`app/layout.tsx`), aplicamos o
 * `data-theme` no `<div>` wrapper aqui — Next 16 App Router permite
 * múltiplos layouts compostos. O CSS scoped pega via descendant selector
 * (`[data-theme="auto-showroom"] body { ... }`).
 *
 * **#211 / Sprint 1 — Schema.org sitewide `@graph`:** injetamos AutoDealer +
 * Organization + LocalBusiness num único `<script>` JSON-LD em todas as
 * rotas `/sites/<slug>/*`. Vehicle (detail) e BreadcrumbList (rotas
 * internas) ficam em scripts próprios das pages.
 *
 * **Schemas SEMPRE injetados (mesmo quando `isIndexable === false`).** AI
 * crawlers (ChatGPT/Perplexity/Claude/Gemini) consomem JSON-LD independente
 * de `robots:noindex` no metadata. Sites em demo/preview ainda se beneficiam
 * de citação em AI Overviews — moat técnico Phase 7.
 *
 * **Fallback path:** quando `getSite` retorna `null`, status `draft`/
 * `archived`, ou variables falham `safeParse`, **omitimos** os schemas
 * (sem JSON-LD parcial). A page abaixo trata `notFound()` de qualquer jeito.
 *
 * **#233:** `generateMetadata` injeta verificação GSC quando
 * `NEXT_PUBLIC_GSC_VERIFICATION` está definida; `<SitesAnalytics>` injeta
 * GA4 (consent-gated) + Vercel Analytics.
 */
export async function generateMetadata(): Promise<Metadata> {
  const token = publicEnv.NEXT_PUBLIC_GSC_VERIFICATION;
  if (!token) return {};
  return { verification: { google: token } };
}

export default async function AutoShowroomLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getSite(slug);

  // Computar sitewide graph apenas quando há site válido e variables
  // parseáveis. Fallback path (null / draft / archived / parse fail) →
  // sem JSON-LD. A page já vai chamar `notFound()` por conta própria.
  const parsedVariables =
    site &&
    site.status !== "draft" &&
    site.status !== "archived"
      ? readSiteVariablesSafe(site.variables)
      : null;
  const variables = parsedVariables?.success ? parsedVariables.data : null;
  const sitewideGraph = variables ? buildSitewideGraph(variables) : null;

  return (
    <div
      data-theme="auto-showroom"
      className="min-h-dvh overflow-x-clip bg-background text-foreground"
    >
      {sitewideGraph && <SiteSchema schemas={sitewideGraph} />}
      {children}
      {variables && <WhatsAppFloatingCTA variables={variables} slug={slug} />}
      {variables && <CookieBanner />}
      {variables && <SitesAnalytics />}
    </div>
  );
}
