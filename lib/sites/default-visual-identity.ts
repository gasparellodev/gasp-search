import { publicEnv } from "@/lib/env-public";
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

/**
 * Resolve o manifest de identidade visual de um site, com fallback pros
 * defaults quando o site não tem VI própria.
 *
 * Decisão de arquitetura (WP4): a fallback é all-or-nothing por manifest.
 * Quando `visual_identity` é null/undefined, retorna o `DEFAULT_VISUAL_IDENTITY`
 * inteiro (não faz merge per-field com `brand_assets`). Motivo: sites sem VI
 * têm `brand_assets.hero_image_url` apontando pra placeholders genéricos
 * (placehold.co) que ficavam visíveis no Hero/About/Contact — o ponto
 * dessa issue é exatamente substituí-los pelo look ducarmo. Sites com VI
 * já têm tudo populado.
 */
export function resolveVisualIdentity(
  visualIdentity: VisualIdentityManifest | null | undefined,
): VisualIdentityManifest {
  return visualIdentity ?? DEFAULT_VISUAL_IDENTITY;
}
