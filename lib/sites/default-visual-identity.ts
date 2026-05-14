import { publicEnv } from "@/lib/env-public";
import type { SiteVariablesV2 } from "@/types/lead-site";
import type { VisualIdentityManifest } from "@/types/visual-identity";

/**
 * Base URL pública dos defaults runtime. Aponta pra `_defaults/v1/` no
 * bucket `visual-identity` (Supabase Storage). Os arquivos são seedados
 * via `scripts/seed-default-visual-identity.ts` (WP3) replicando a
 * identidade canônica de `4t3xswas-ducarmo-veiculos`.
 *
 * Quando uma nova versão de defaults for seedada, bump pra `_defaults/v2/`
 * + atualiza esta constante (evita cache de CDN servindo versão antiga).
 */
const DEFAULT_VISUAL_IDENTITY_BASE = `${publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/visual-identity/_defaults/v1`;

/**
 * Manifest default consumido por sites sem `visual_identity` própria.
 *
 * Estratégia (WP4 — issue #312): qualquer site renderizado sem manifest AI
 * gerado herda automaticamente este shape. Sites com VI própria
 * (ex: ducarmo-veiculos) continuam intactos — `resolveVisualIdentity()`
 * faz a escolha.
 *
 * Origem dos assets: replica do ducarmo-veiculos (GPT-Image-2 gerado em
 * 2026-05-14). Apenas a categoria sedan está disponível por enquanto;
 * `<HomeCategoriesCars>` faz fallback gracioso pras outras categorias.
 *
 * Para atualizar: rodar `scripts/seed-default-visual-identity.ts`, copiar
 * o manifest impresso e substituir aqui (mantendo `generated_at`/`model`
 * que vieram do log do script).
 */
export const DEFAULT_VISUAL_IDENTITY: VisualIdentityManifest = {
  hero_url: `${DEFAULT_VISUAL_IDENTITY_BASE}/hero.png`,
  about_url: `${DEFAULT_VISUAL_IDENTITY_BASE}/about.png`,
  contact_url: `${DEFAULT_VISUAL_IDENTITY_BASE}/contact.png`,
  categories_urls: [`${DEFAULT_VISUAL_IDENTITY_BASE}/category-sedan.png`],
  generated_at: "2026-05-14T12:58:42.333Z",
  model: "gpt-image-2-2026-04-21",
  cost_estimate_brl: 0,
};

type BrandAssetsForResolution = Pick<
  SiteVariablesV2["brand_assets"],
  "hero_image_url" | "about_image_url" | "contact_image_url"
>;

/**
 * Heurística pra detectar URLs placeholder (placehold.co) que não devem
 * sobrescrever os defaults — sites legados foram criados com essas URLs
 * antes de WP4 e o objetivo é exibir os defaults editoriais no lugar.
 */
function isPlaceholderUrl(url: string): boolean {
  return /placehold(?:\.co|er)/i.test(url);
}

function preferred(
  brandUrl: string | null | undefined,
  defaultUrl: string,
): string {
  if (typeof brandUrl !== "string") return defaultUrl;
  const trimmed = brandUrl.trim();
  if (trimmed.length === 0) return defaultUrl;
  if (isPlaceholderUrl(trimmed)) return defaultUrl;
  return trimmed;
}

/**
 * Resolve o manifest de identidade visual de um site, com fallback pros
 * defaults quando o site não tem VI própria.
 *
 * **Cadeia de precedência (per-field, WP4 fix 2026-05-14):**
 *   1. `visualIdentity.<field>` — quando o site tem manifest AI próprio.
 *   2. `brandAssets.<field>` — quando admin editou via upload no editor
 *      (`<HeroUploadField>`, `<LogoUploadField>`, etc.).
 *   3. `DEFAULT_VISUAL_IDENTITY.<field>` — fallback editorial.
 *
 * URLs `placehold.co` em brand_assets são tratadas como ausentes (caem
 * pra default), preservando o look premium em sites legados que ainda
 * têm placeholders herdados do pipeline brand-assets v1.
 *
 * **Decisão arquitetural revisada:** o WP4 original (all-or-nothing)
 * quebrava o upload de hero do admin — se o admin trocava o hero via
 * `<HeroUploadField>`, o `brand_assets.hero_image_url` era atualizado mas
 * o resolver retornava o DEFAULT inteiro porque `visual_identity` era null.
 * Per-field fallback resolve isso sem regressão pros sites com placeholder.
 */
export function resolveVisualIdentity(
  visualIdentity: VisualIdentityManifest | null | undefined,
  brandAssets?: BrandAssetsForResolution | null,
): VisualIdentityManifest {
  if (visualIdentity) return visualIdentity;

  return {
    ...DEFAULT_VISUAL_IDENTITY,
    hero_url: preferred(
      brandAssets?.hero_image_url,
      DEFAULT_VISUAL_IDENTITY.hero_url,
    ),
    about_url: preferred(
      brandAssets?.about_image_url,
      DEFAULT_VISUAL_IDENTITY.about_url,
    ),
    contact_url: preferred(
      brandAssets?.contact_image_url,
      DEFAULT_VISUAL_IDENTITY.contact_url,
    ),
  };
}

/**
 * Larguras geradas pelo `scripts/optimize-default-assets.ts` (WP8 #316).
 * Mantém em sync com o array `WIDTHS` daquele script.
 */
const DEFAULT_OPTIMIZED_WIDTHS = [640, 1280, 1920] as const;

/**
 * Nome base (sem extensão) dos arquivos default conhecidos. Usado pra
 * matchear `hero_url`/`about_url`/etc. contra URLs do bucket `_defaults/v1/`.
 */
const DEFAULT_OPTIMIZED_NAMES = ["hero", "about", "contact"] as const;

export interface OptimizedSources {
  avifSrcset: string;
  webpSrcset: string;
  fallbackPngUrl: string;
}

/**
 * Se a URL aponta pra um dos assets default em `_defaults/v1/`, retorna
 * o set otimizado (AVIF + WebP + PNG fallback) pra `<picture>` markup.
 *
 * Retorna `null` quando a URL não é um default conhecido — o consumer
 * cai no `<Image>` legado sem mudança.
 *
 * Os arquivos otimizados são produzidos por
 * `scripts/optimize-default-assets.ts` (WP8 #316) em 3 larguras (640/
 * 1280/1920) × 2 formatos (AVIF/WebP). PNG original fica como fallback
 * pra browsers sem AVIF/WebP support.
 */
export function getOptimizedSourcesForDefault(
  url: string | null | undefined,
): OptimizedSources | null {
  if (!url) return null;
  for (const name of DEFAULT_OPTIMIZED_NAMES) {
    const expectedPng = `${DEFAULT_VISUAL_IDENTITY_BASE}/${name}.png`;
    if (url !== expectedPng) continue;
    const avifSrcset = DEFAULT_OPTIMIZED_WIDTHS.map(
      (w) => `${DEFAULT_VISUAL_IDENTITY_BASE}/${name}-${w}.avif ${w}w`,
    ).join(", ");
    const webpSrcset = DEFAULT_OPTIMIZED_WIDTHS.map(
      (w) => `${DEFAULT_VISUAL_IDENTITY_BASE}/${name}-${w}.webp ${w}w`,
    ).join(", ");
    return { avifSrcset, webpSrcset, fallbackPngUrl: expectedPng };
  }
  return null;
}
