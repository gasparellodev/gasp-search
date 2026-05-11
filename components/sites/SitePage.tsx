import "server-only";

import type { CSSProperties, ReactNode } from "react";

import { sanitizeHex } from "@/lib/sites/sanitize";
import type { SiteVariablesV2 } from "@/types/lead-site";
import type { VisualIdentityManifest } from "@/types/visual-identity";
import { cn } from "@/lib/utils";

import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { HomeCategoriesCars } from "./home/HomeCategoriesCars";
import { HomeEmphasis } from "./home/HomeEmphasis";
import { HomeFinancingWidget } from "./home/HomeFinancingWidget";
import { HomeForm } from "./home/HomeForm";
import { HomeHero } from "./home/HomeHero";
import { HomeRecentArrivals } from "./home/HomeRecentArrivals";
import { HomeTradeinWidget } from "./home/HomeTradeinWidget";
import { HomeTrustStrip } from "./home/HomeTrustStrip";
import { RoadDivider } from "./RoadDivider";
import type { ActivePage } from "./site-nav-links";

interface SitePageProps {
  variables: SiteVariablesV2;
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
  /**
   * Manifest de identidade visual AI (Sprint 2 / #A3 / issue #217).
   *
   * Quando presente (parseado upstream via `getSite()` em #217), a Home
   * usa `manifest.hero_url` como hero image — fallback gracioso pra
   * `variables.brand_assets.hero_image_url` quando `null`. Sub-rotas
   * (`/sobre`, `/contato`) NÃO usam este prop diretamente: elas passam
   * o override pra `<AboutSection manifestAboutUrl>` / `<ContactSection
   * manifestContactUrl>` separadamente.
   */
  manifest?: VisualIdentityManifest | null;
  /**
   * Classes opcionais aplicadas ao `<main>`. Usado por rotas com UI fixed
   * mobile (ex.: barra de financiamento no detalhe do carro) para reservar
   * espaço sem afetar o wrapper global.
   */
  mainClassName?: string;
  /**
   * Rating Google do lead — propagado pra `<HomeTrustStrip>` (Sprint 4 #H1
   * / #221). Caller (`app/sites/[slug]/page.tsx`) lê de `site.lead_rating`
   * que vem do join `lead_sites → leads` em `getSite()`. Null cai em fallback
   * "4.8★ 87 reviews" — props explícitas, NÃO via `SiteVariables` (evita migration).
   */
  rating?: number | null;
  /** Contagem de reviews Google — pareada com `rating`. */
  reviewsCount?: number | null;
}

/**
 * Wrapper público do site renderizado em `/sites/[slug]` e sub-rotas
 * (issues #160, #162, #163, v2 em #206).
 *
 * Modos de operação:
 *  - **Home (default)**: sem `children`. Compõe a Home V2 (Sprint 4 H1+H2 —
 *    issues #221 e #222): `HomeHero` → `HomeTrustStrip` → `HomeCategoriesCars`
 *    → `HomeRecentArrivals` → `HomeFinancingWidget` → `HomeTradeinWidget` →
 *    `HomeForm` → `HomeEmphasis`.
 *  - **Sub-rota**: com `children`. Renderiza o conteúdo da rota entre
 *    Header e Footer. Caller passa `activePage="sobre"|"contato"|...`.
 *
 * **CSS vars**: injeta `--site-primary` e `--site-text-on-primary` no
 * wrapper — todos os Site Components consomem via `style` inline
 * sanitizado ou Tailwind v4. Defesa em profundidade via `sanitizeHex`
 * antes da injeção (input adversarial vira fallback `#0C0C0C`).
 *
 * **v2 (#206):** brand assets vêm de `variables.brand_assets` nested.
 * Slogan é optional em v2 — fallback para `business_name` quando
 * passamos pra `<HomeHero>` (prop required).
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
  manifest = null,
  mainClassName,
  rating = null,
  reviewsCount = null,
}: SitePageProps) {
  const { brand_assets } = variables;
  const primary = sanitizeHex(brand_assets.primary_color);
  const textOnPrimary = sanitizeHex(brand_assets.text_on_primary);
  // #217 — Manifest tem precedência; fallback graceful pro brand_assets v2.
  // #221 — Slogan removido da Home V2 (H1 agora é "<biz> — Carros seminovos em <city>"
  // construído em `<HomeHero>` a partir de `business_name` + `address`).
  const heroImageUrl = manifest?.hero_url ?? brand_assets.hero_image_url;

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
      <main className={cn(mainClassName)}>
        <div
          data-site-header-sentinel
          aria-hidden="true"
          className="h-px w-px"
        />
        {children ?? (
          <>
            <HomeHero
              business_name={variables.business_name}
              hero_image_url={heroImageUrl}
              primary_color={brand_assets.primary_color}
              text_on_primary={brand_assets.text_on_primary}
              slug={slug}
              address={variables.address}
              cars={variables.cars}
            />
            <HomeTrustStrip
              yearsInMarket={variables.years_in_market}
              rating={rating}
              reviewsCount={reviewsCount}
            />
            <RoadDivider />
            <HomeCategoriesCars
              slug={slug}
              manifestCategoriesUrls={manifest?.categories_urls ?? null}
            />
            <HomeRecentArrivals
              cars={variables.cars}
              siteSlug={slug}
              whatsappPhone={variables.whatsapp}
              businessName={variables.business_name}
            />
            <HomeFinancingWidget
              whatsappPhone={variables.whatsapp}
              businessName={variables.business_name}
              siteSlug={slug}
            />
            <HomeTradeinWidget
              manifestAboutUrl={manifest?.about_url ?? null}
              aboutImageUrl={brand_assets.about_image_url}
              siteSlug={slug}
              whatsappPhone={variables.whatsapp}
              businessName={variables.business_name}
            />
            <HomeForm
              siteId={siteId}
              slug={slug}
              primary_color={brand_assets.primary_color}
              text_on_primary={brand_assets.text_on_primary}
            />
            <HomeEmphasis emphasis={variables.emphasis} />
          </>
        )}
      </main>
      <SiteFooter variables={variables} />
    </div>
  );
}
