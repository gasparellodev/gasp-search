/**
 * `buildSiteMetadata` — helper compartilhado para `generateMetadata`
 * dinâmico em todas as 6 rotas `/sites/[slug]/*` (issue #165, v2 em #206).
 *
 * Fonte canônica: §11 (componentes UI) + §13 (segurança/SEO) do spec
 * mestre em
 * `docs/superpowers/specs/2026-05-08-gerador-sites-concessionarias-design.md`.
 *
 * **Por que helper compartilhado?** As 6 rotas compartilham title format,
 * lógica de description, OG image, Twitter card e robots. Apenas
 * `pageLabel` muda por rota — DRY justifica extração.
 *
 * **v2 (#206):**
 * - Aceita `SiteVariablesV2` (shape nested): `brand_assets.logo_url` em
 *   vez de `logo_url` flat.
 * - `slogan` é optional em v2 — fallback gracioso quando ausente/curto.
 *
 * **Decisões V1**:
 *   1. Title: `${business_name} — ${pageLabel}`.
 *   2. Description: `slogan` se ≥40 chars; senão fallback genérico.
 *      Boundary inclusive: 40 chars usa slogan.
 *   3. OG image: `brand_assets.logo_url` (única URL garantida sempre
 *      presente; passa via `safeUrl` em #159 antes de chegar aqui).
 *   4. Twitter card: `summary_large_image` (preview rico).
 *   5. `noindex/nofollow` PRESERVADO sempre — site público de lead não
 *      vai pra SERP. Hardening adicional via `X-Robots-Tag` em V2.
 *
 * **Server-only**: helper puro (sem DB/env). Vive lado server por
 * consistência com `lib/sites/`.
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

import type { SiteVariablesV2 } from "@/types/lead-site";

/**
 * Subset de `SiteVariablesV2` consumido pelo helper. Tipado como `Pick`
 * para facilitar testes sem abrir mão do tipo runtime de `SiteVariablesV2`.
 */
export type SiteMetadataInput = Pick<
  SiteVariablesV2,
  "business_name" | "slogan" | "brand_assets"
>;

/**
 * Threshold de description. Boundary **inclusive** (40 chars usa o slogan).
 */
export const DESCRIPTION_MIN_LENGTH = 40;

export function buildSiteMetadata(params: {
  variables: SiteMetadataInput;
  pageLabel: string;
}): Metadata {
  const { variables, pageLabel } = params;
  const title = `${variables.business_name} — ${pageLabel}`;
  // slogan é optional em v2; fallback se ausente ou curto.
  const slogan = variables.slogan ?? "";
  const description =
    slogan.length >= DESCRIPTION_MIN_LENGTH
      ? slogan
      : `Encontre seu próximo veículo na ${variables.business_name}.`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      images: [{ url: variables.brand_assets.logo_url }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [variables.brand_assets.logo_url],
    },
  };
}
