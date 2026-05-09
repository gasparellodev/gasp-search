import "server-only";

import type { CSSProperties } from "react";

import { sanitizeHex } from "@/lib/sites/sanitize";
import type { SiteVariables } from "@/types/lead-site";

import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { HomeCategories } from "./home/HomeCategories";
import { HomeEmphasis } from "./home/HomeEmphasis";
import { HomeForm } from "./home/HomeForm";
import { HomeHero } from "./home/HomeHero";
import { HomeRecentSales } from "./home/HomeRecentSales";

interface SitePageProps {
  variables: SiteVariables;
  siteId: string;
  slug: string;
}

/**
 * Wrapper público do site renderizado em `/sites/[slug]` (issue #160 +
 * #162).
 *
 * Compõe a Home completa: `<SiteHeader>` + 5 seções (`HomeHero`,
 * `HomeCategories`, `HomeForm`, `HomeEmphasis`, `HomeRecentSales`) +
 * `<SiteFooter>`.
 *
 * **CSS vars**: injeta `--site-primary` e `--site-text-on-primary` no
 * wrapper — todos os Site Components consomem via `style` inline
 * sanitizado ou Tailwind v4. Defesa em profundidade via `sanitizeHex`
 * antes da injeção (input adversarial vira fallback `#0C0C0C`).
 *
 * **Pin de teste**: `data-site-id` exposto no wrapper para asserts em
 * E2E Playwright (#166).
 */
export function SitePage({ variables, siteId, slug }: SitePageProps) {
  const primary = sanitizeHex(variables.primary_color);
  const textOnPrimary = sanitizeHex(variables.text_on_primary);

  const cssVars = {
    "--site-primary": primary,
    "--site-text-on-primary": textOnPrimary,
  } as CSSProperties;

  return (
    <div
      className="site-page min-h-dvh bg-background text-foreground"
      data-site-id={siteId}
      data-site-slug={slug}
      style={cssVars}
    >
      <SiteHeader variables={variables} slug={slug} activePage="home" />
      <main>
        <HomeHero
          business_name={variables.business_name}
          slogan={variables.slogan}
          hero_image_url={variables.hero_image_url}
          primary_color={variables.primary_color}
          text_on_primary={variables.text_on_primary}
          slug={slug}
        />
        <HomeCategories
          categories={variables.home_categories}
          slug={slug}
        />
        <HomeForm
          siteId={siteId}
          slug={slug}
          primary_color={variables.primary_color}
          text_on_primary={variables.text_on_primary}
        />
        <HomeEmphasis emphasis={variables.emphasis} />
        <HomeRecentSales recent_sales={variables.recent_sales} />
      </main>
      <SiteFooter variables={variables} />
    </div>
  );
}
