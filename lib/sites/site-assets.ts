/**
 * Centralização de assets visuais do Site Generator (Phase 7).
 *
 * Decorativos (sempre o mesmo, independente de tenant): `hero.texture` —
 * grain pattern atrás do cutout do carro no hero escuro.
 *
 * Demo defaults (fallback quando o lead não tem asset próprio):
 * `hero.demoCarCutout`, `emphasis.demoImage`, `recentSales.demoImage`.
 *
 * Pra trocar o demo globalmente: editar este arquivo.
 * Pra trocar imagem por lead: atualizar `lead_sites.payload.variables.<campo>`
 * no Supabase (`hero_image_url`, `emphasis.image_url`, `recent_sales[].image_url`).
 */

export const SITE_ASSETS = {
  hero: {
    texture: "/assets/hero/texturatc.png",
    /**
     * Porsche cutout cinza prata — default global (decisão final 2026-05-09).
     * Match com o mockup Figma `Home.png` que usa Porsche no hero. Substituiu
     * Toyota e Pulse, que continuam disponíveis como variants. PNG transparente.
     */
    demoCarCutout: "/assets/hero/porsche-model1.png",
  },
  emphasis: { demoImage: "/assets/emphasis/macan.png" },
  recentSales: { demoImage: "/assets/sale/ram.png" },
} as const;

export type SiteAssetGroup = keyof typeof SITE_ASSETS;

/**
 * Resolve a URL da imagem do hero. Usa `hero_image_url` do lead (vindo de
 * `SiteVariables.hero_image_url`) quando truthy; senão cai no demo cutout
 * global (`SITE_ASSETS.hero.demoCarCutout`).
 *
 * Aceita `null`/`undefined`/string vazia como "ausente" — todos caem no
 * fallback.
 */
export function resolveHeroImageUrl(
  hero_image_url: string | null | undefined,
): string {
  if (typeof hero_image_url !== "string" || hero_image_url.length === 0) {
    return SITE_ASSETS.hero.demoCarCutout;
  }
  return hero_image_url;
}
