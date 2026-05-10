/**
 * `buildSiteMetadata` — helper compartilhado para `generateMetadata`
 * dinâmico em todas as 6 rotas `/sites/[slug]/*` (issue #165).
 *
 * Fonte canônica: §11 (componentes UI) + §13 (segurança/SEO) do spec
 * mestre em
 * `docs/superpowers/specs/2026-05-08-gerador-sites-concessionarias-design.md`.
 *
 * **Por que helper compartilhado?** As 6 rotas (Home, Sobre, Contato,
 * Anunciar, Estoque, Detalhe-do-carro) compartilham:
 *   - Mesmo formato de title (`${business_name} — ${pageLabel}`).
 *   - Mesma lógica de description (slogan ≥40 chars vs fallback).
 *   - Mesma OG image (`variables.logo_url`).
 *   - Mesmo Twitter card (`summary_large_image`).
 *   - Mesmo `robots: { index: false, follow: false }`.
 *
 * Apenas o `pageLabel` muda por rota — DRY justifica extração.
 *
 * **Decisões V1** (per AC1):
 *   1. Title: `${business_name} — ${pageLabel}`. Sem `city` (não existe
 *      em `SiteVariables`).
 *   2. Description: `slogan` se ≥40 chars; senão fallback
 *      `Encontre seu próximo veículo na ${business_name}.`. Boundary
 *      inclusive: 40 chars usa slogan, 39 cai no fallback.
 *   3. OG image: `variables.logo_url` (única URL garantida sempre
 *      presente; passa via `safeUrl` em #159 antes de chegar aqui).
 *   4. Twitter card: `summary_large_image` (preview rico).
 *   5. `noindex/nofollow` PRESERVADO sempre — site público de lead não
 *      vai pra SERP. Hardening adicional via `X-Robots-Tag` em V2.
 *
 * **Server-only**: o helper é puro (não toca DB nem env), mas vive no
 * lado server porque é consumido apenas por `generateMetadata` em
 * Server Components / Server Routes. Marcamos como server-only por
 * consistência com o resto de `lib/sites/`.
 *
 * **Quando o caller deve usar este helper vs returnar `noindex` puro?**
 * Sempre que o site for renderizável (status `published` / `sent` +
 * `SiteVariables.safeParse` ok). Para casos `null`/`draft`/`archived`/
 * variables inválido, o caller retorna apenas
 * `{ robots: { index: false, follow: false } }` — sem expor title /
 * description / OG image (que poderiam vazar dados parciais).
 */
import "server-only";

import type { Metadata } from "next";

import type { SiteVariables } from "@/types/lead-site";

/**
 * Subset de `SiteVariables` consumido pelo helper. Tipado como `Pick`
 * para facilitar testes (não precisamos passar fixture completa) sem
 * abrir mão do tipo runtime de `SiteVariables`.
 */
export type SiteMetadataInput = Pick<
  SiteVariables,
  "business_name" | "slogan" | "logo_url"
>;

/**
 * Threshold de description: slogans curtos demais não dão contexto
 * suficiente para previews sociais. 40 chars é o piso do `slogan`
 * "denso" o bastante pra OG/Twitter — abaixo disso usamos fallback
 * orientado à intenção do usuário ("encontre seu próximo veículo").
 *
 * Boundary é **inclusive**: exatamente 40 chars usa o slogan.
 */
export const DESCRIPTION_MIN_LENGTH = 40;

export function buildSiteMetadata(params: {
  variables: SiteMetadataInput;
  pageLabel: string;
}): Metadata {
  const { variables, pageLabel } = params;
  const title = `${variables.business_name} — ${pageLabel}`;
  const description =
    variables.slogan.length >= DESCRIPTION_MIN_LENGTH
      ? variables.slogan
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
