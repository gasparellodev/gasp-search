/**
 * `buildSiteMetadata` — helper compartilhado para `generateMetadata`
 * dinâmico em todas as 6 rotas `/sites/[slug]/*` (issue #165, v2 em #206,
 * SEO foundation em #199).
 *
 * Fonte canônica: §11 (componentes UI) + §13 (segurança/SEO) do spec
 * mestre em
 * `docs/superpowers/specs/2026-05-08-gerador-sites-concessionarias-design.md`
 * e `docs/SEO-PLAN.md` (Sprint 0 #F2).
 *
 * **Por que helper compartilhado?** As 6 rotas compartilham title format,
 * lógica de description, OG image, Twitter card e robots. Apenas
 * `pageLabel`/`route` muda por rota — DRY justifica extração.
 *
 * **v3 (#199 — SEO foundation):**
 * - `isIndexable(site)` exportado — gate único pra robots index/follow
 *   (true sse `status IN ('published','sent') AND signed_at !== null`).
 * - `metadataBase` sempre presente (= `env.NEXT_PUBLIC_APP_URL`).
 * - `alternates.canonical` absoluto via `business_slug` + `pathname`.
 * - `alternates.languages: { 'pt-BR': canonical, 'x-default': canonical }`.
 * - City-aware title/description quando `route` discriminator é passado.
 * - **Backward-compat:** `site`/`pathname`/`route` todos opcionais.
 *   - Sem `site` → robots `{ index: false, follow: false }` preservado.
 *   - Sem `route` → title `${business_name} — ${pageLabel}` (legacy).
 *
 * **v2 (#206):** aceita `SiteVariablesV2` (shape nested) — `brand_assets.logo_url`.
 *
 * **Server-only**: helper puro (sem DB). Lê `env` no nível server.
 *
 * **Quando o caller deve usar este helper vs returnar `noindex` puro?**
 * Sempre que o site for renderizável (status `published` / `sent` +
 * `readSiteVariablesSafe` ok). Para casos `null`/`draft`/`archived`/
 * variables inválido, o caller retorna apenas
 * `{ robots: { index: false, follow: false } }` — sem expor title /
 * description / OG image (que poderiam vazar dados parciais).
 */
import "server-only";

import type { Metadata } from "next";

import { env } from "@/lib/env";
import type { Address, SiteVariablesV2 } from "@/types/lead-site";

/**
 * Subset de `SiteVariablesV2` consumido pelo helper. Tipado como `Pick`
 * para facilitar testes sem abrir mão do tipo runtime de `SiteVariablesV2`.
 *
 * Inclui `business_slug` (para canonical), `address` (para city-aware
 * patterns — nullable per #197 §A1).
 */
export type SiteMetadataInput = Pick<
  SiteVariablesV2,
  "business_name" | "business_slug" | "slogan" | "address" | "brand_assets"
>;

/**
 * Subset de `lead_sites` consumido pelo gate `isIndexable`. Tipado como
 * `Pick` pra desacoplar do shape completo do `Database['public']['Tables']
 * ['lead_sites']['Row']` em testes.
 */
export type IndexableSite = {
  status: string;
  signed_at: string | null;
};

/**
 * Discriminator das rotas conhecidas — habilita city-aware
 * title/description patterns (per `docs/SEO-PLAN.md`).
 *
 * Quando `route` é passado, o helper usa patterns city-aware com
 * fallback gracioso pra `address === null`. Quando ausente, o helper
 * cai no formato legacy `${business_name} — ${pageLabel}` (compat
 * com chamadas v1 não migradas).
 */
export type SiteRoute =
  | { kind: "home" }
  | { kind: "estoque" }
  | {
      kind: "detalhe";
      car: {
        brand: string;
        model: string;
        year: number;
        km?: number | null;
        price?: number | null;
      };
    }
  | { kind: "sobre" }
  | { kind: "contato" }
  | { kind: "anunciar" };

/**
 * Threshold de description. Boundary **inclusive** (40 chars usa o slogan).
 */
export const DESCRIPTION_MIN_LENGTH = 40;

/**
 * Hard cap defensivo no description (Google SERP corta em ~160 chars).
 */
export const DESCRIPTION_MAX_LENGTH = 160;

// ---------------------------------------------------------------------------
// isIndexable — gate único para robots.index/follow + sitemap (#212)
// ---------------------------------------------------------------------------

/**
 * Retorna `true` sse o site pode ser indexado por search engines.
 *
 * Whitelist defensiva: **somente** `status IN ('published','sent') AND
 * signed_at IS NOT NULL`. Qualquer outro status (`draft`, `archived`,
 * ou status desconhecido futuro) ou `signed_at` null retorna `false`.
 *
 * **Escopo:** SEO/sitemap toggle apenas. NÃO usado para routing 404 —
 * esse continua em `app/sites/[slug]/page.tsx` que trata `draft`/
 * `archived` via `notFound()`.
 *
 * Decisão V1 (#199): admin marca `signed_at` manualmente após cliente
 * assinar contrato. Sem backfill — todos os sites legados nasceram
 * com `signed_at: null` (não indexados até decisão explícita).
 */
export function isIndexable(site: IndexableSite): boolean {
  return (
    (site.status === "published" || site.status === "sent") &&
    site.signed_at !== null
  );
}

// ---------------------------------------------------------------------------
// Helpers internos — city/state extraction com fallback null-safe
// ---------------------------------------------------------------------------

function cityState(address: Address | null): {
  city: string | null;
  state: string | null;
} {
  if (address === null) return { city: null, state: null };
  return { city: address.city, state: address.state };
}

/**
 * Truncamento defensivo no description. Trim final para evitar
 * descrição terminando em espaço.
 */
function clampDescription(input: string): string {
  return input.length <= DESCRIPTION_MAX_LENGTH
    ? input
    : input.slice(0, DESCRIPTION_MAX_LENGTH).trim();
}

/**
 * Constrói canonical URL absoluta. `pathname='/'` vira `''` (apenas
 * `/sites/<slug>`); demais pathnames são apensados crús.
 */
function buildCanonical(businessSlug: string, pathname: string): string {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const tail = pathname === "/" ? "" : pathname;
  return `${base}/sites/${businessSlug}${tail}`;
}

// ---------------------------------------------------------------------------
// City-aware title patterns (per docs/SEO-PLAN.md)
// ---------------------------------------------------------------------------

function buildCityAwareTitle(
  route: SiteRoute,
  variables: SiteMetadataInput,
): string {
  const { city, state } = cityState(variables.address);
  const name = variables.business_name;
  const hasCity = city !== null && state !== null;

  switch (route.kind) {
    case "home":
      return hasCity
        ? `${name} — Loja de Seminovos em ${city}, ${state}`
        : `${name} — Loja de Seminovos`;
    case "estoque":
      return hasCity
        ? `Estoque de Seminovos em ${city} — ${name}`
        : `Estoque de Seminovos — ${name}`;
    case "detalhe": {
      const { brand, model, year } = route.car;
      return hasCity
        ? `${brand} ${model} ${year} em ${city} — ${name}`
        : `${brand} ${model} ${year} — ${name}`;
    }
    case "sobre":
      return hasCity ? `Sobre ${name} — Loja em ${city}` : `Sobre ${name}`;
    case "contato":
      return hasCity
        ? `Contato ${name} — ${city}, ${state}`
        : `Contato ${name}`;
    case "anunciar":
      return hasCity
        ? `Anuncie seu carro em ${city} — ${name}`
        : `Anuncie seu carro — ${name}`;
  }
}

// ---------------------------------------------------------------------------
// City-aware description patterns (≤ 160 chars)
// ---------------------------------------------------------------------------

function buildCityAwareDescription(
  route: SiteRoute,
  variables: SiteMetadataInput,
): string {
  const { city, state } = cityState(variables.address);
  const name = variables.business_name;
  const hasCity = city !== null && state !== null;
  const slogan = variables.slogan ?? "";
  const sloganOrFallback =
    slogan.length >= DESCRIPTION_MIN_LENGTH
      ? slogan
      : `Encontre seu próximo veículo na ${name}.`;

  let raw: string;
  switch (route.kind) {
    case "home":
      raw = hasCity
        ? `Conheça a ${name} em ${city}/${state}. ${sloganOrFallback}`
        : sloganOrFallback;
      break;
    case "estoque":
      raw = hasCity
        ? `Veja o estoque atualizado de seminovos em ${city}. Confira os veículos disponíveis na ${name}.`
        : `Estoque atualizado de seminovos na ${name}.`;
      break;
    case "detalhe": {
      const { brand, model, year, km, price } = route.car;
      const kmPart = typeof km === "number" ? `, ${km.toLocaleString("pt-BR")} km` : "";
      const pricePart =
        typeof price === "number"
          ? ` R$ ${price.toLocaleString("pt-BR")}.`
          : "";
      raw = hasCity
        ? `${brand} ${model} ${year}${kmPart} à venda em ${city}.${pricePart} ${name}.`
        : `${brand} ${model} ${year}${kmPart} à venda na ${name}.${pricePart}`;
      break;
    }
    case "sobre":
      raw = hasCity
        ? `Conheça a história da ${name}, loja de seminovos em ${city}/${state}.`
        : `Conheça a história da ${name}.`;
      break;
    case "contato":
      raw = hasCity
        ? `Entre em contato com a ${name} em ${city}/${state}. WhatsApp, telefone e endereço.`
        : `Entre em contato com a ${name}. WhatsApp, telefone e endereço.`;
      break;
    case "anunciar":
      raw = hasCity
        ? `Anuncie seu carro com a ${name} em ${city}. Avaliação rápida e justa.`
        : `Anuncie seu carro com a ${name}. Avaliação rápida e justa.`;
      break;
  }

  return clampDescription(raw);
}

// ---------------------------------------------------------------------------
// buildSiteMetadata — entry point
// ---------------------------------------------------------------------------

export function buildSiteMetadata(params: {
  variables: SiteMetadataInput;
  pageLabel: string;
  /**
   * Site row (subset). Quando ausente, robots cai pra `{ index: false,
   * follow: false }` (backward-compat — comportamento original do helper).
   */
  site?: IndexableSite;
  /**
   * Pathname relativo (ex: `/`, `/estoque`, `/estoque/civic-2020`).
   * Default `/`. Usado pra construir canonical URL absoluta.
   */
  pathname?: string;
  /**
   * Discriminator de rota. Quando passado, ativa city-aware
   * title/description patterns. Quando ausente, helper usa legacy
   * `${business_name} — ${pageLabel}` (compat).
   */
  route?: SiteRoute;
}): Metadata {
  const { variables, pageLabel, site, pathname = "/", route } = params;

  // Title: city-aware quando `route` provided, senão legacy.
  const title = route
    ? buildCityAwareTitle(route, variables)
    : `${variables.business_name} — ${pageLabel}`;

  // Description: city-aware quando `route` provided, senão slogan-based.
  let description: string;
  if (route) {
    description = buildCityAwareDescription(route, variables);
  } else {
    const slogan = variables.slogan ?? "";
    description =
      slogan.length >= DESCRIPTION_MIN_LENGTH
        ? slogan
        : `Encontre seu próximo veículo na ${variables.business_name}.`;
  }

  // robots: gate via isIndexable quando `site` provided; senão noindex
  // (backward-compat — qualquer caller não migrado mantém comportamento
  // original de noindex/nofollow defensivo).
  const indexable = site !== undefined ? isIndexable(site) : false;
  const robots = { index: indexable, follow: indexable };

  // Canonical absoluto + hreflang pt-BR + x-default (V1 monolíngue).
  const canonical = buildCanonical(variables.business_slug, pathname);

  return {
    metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
    title,
    description,
    robots,
    alternates: {
      canonical,
      languages: {
        "pt-BR": canonical,
        "x-default": canonical,
      },
    },
    openGraph: {
      title,
      description,
      images: [{ url: variables.brand_assets.logo_url }],
      type: "website",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [variables.brand_assets.logo_url],
    },
  };
}
