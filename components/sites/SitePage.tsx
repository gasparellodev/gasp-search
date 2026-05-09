import "server-only";

import type { CSSProperties, ReactNode } from "react";

import { sanitizeHex } from "@/lib/sites/sanitize";
import type { SiteVariables } from "@/types/lead-site";

import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { HomeCategories } from "./home/HomeCategories";
import { HomeEmphasis } from "./home/HomeEmphasis";
import { HomeForm } from "./home/HomeForm";
import { HomeHero } from "./home/HomeHero";
import { HomeRecentSales } from "./home/HomeRecentSales";
import type { ActivePage } from "./site-nav-links";

interface SitePageProps {
  variables: SiteVariables;
  siteId: string;
  slug: string;
  /**
   * Página corrente — recebida pelo `<SiteHeader>` para destacar o link
   * ativo no nav (variant "Selected"). Default `'home'` mantém o
   * comportamento original (issue #160 / #162).
   */
  activePage?: ActivePage;
  /**
   * Conteúdo a renderizar entre Header e Footer. Quando ausente,
   * `<SitePage>` renderiza a Home composition (Hero + Categories +
   * Form + Emphasis + RecentSales — issue #162). Quando presente, o
   * caller (`/sobre`, `/contato`, `/anunciar` — issue #163) injeta a
   * seção da página atual no lugar.
   */
  children?: ReactNode;
}

/**
 * Wrapper público do site renderizado em `/sites/[slug]` e sub-rotas
 * (issues #160, #162, #163).
 *
 * Modos de operação:
 *  - **Home (default)**: sem `children`. Compõe as 5 seções (`HomeHero`,
 *    `HomeCategories`, `HomeForm`, `HomeEmphasis`, `HomeRecentSales`).
 *  - **Sub-rota**: com `children`. Renderiza o conteúdo da rota entre
 *    Header e Footer. Caller passa `activePage="sobre"|"contato"|...`.
 *
 * **CSS vars**: injeta `--site-primary` e `--site-text-on-primary` no
 * wrapper — todos os Site Components consomem via `style` inline
 * sanitizado ou Tailwind v4. Defesa em profundidade via `sanitizeHex`
 * antes da injeção (input adversarial vira fallback `#0C0C0C`).
 *
 * **Pin de teste**: `data-site-id` exposto no wrapper para asserts em
 * E2E Playwright (#166).
 */
export function SitePage({
  variables,
  siteId,
  slug,
  activePage = "home",
  children,
}: SitePageProps) {
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
      <SiteHeader variables={variables} slug={slug} activePage={activePage} />
      <main>
        {children ?? (
          <>
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
          </>
        )}
      </main>
      <SiteFooter variables={variables} />
    </div>
  );
}
