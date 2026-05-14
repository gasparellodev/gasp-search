/**
 * Tipos de saída do pipeline `extractBrandAssets` (issue #156).
 *
 * **Fonte canônica:** §5 do spec mestre
 * (`docs/superpowers/specs/2026-05-08-gerador-sites-concessionarias-design.md`,
 * linhas 199–229).
 *
 * `AssetSources` é o subset de `lead_sites.variables` que vem do pipeline
 * de brand assets — não da IA (copy) e não de inputs fixos (whatsapp, ano,
 * km, preço). O orquestrador `generateLeadSite` (#159) compõe estes
 * campos com `SiteCopy` (de `generate-copy.ts`) e dados do lead pra
 * formar o `SiteVariables` completo.
 */

/**
 * Saída do pipeline de brand assets.
 *
 * Garantias:
 * - `primary_color` sempre passa `/^#[0-9a-f]{6}$/i`.
 * - `text_on_primary` é exatamente `'#FFFFFF'` ou `'#0C0C0C'` (WCAG AA).
 * - `car_placeholder_urls.length === 6` sempre (preenchido via `pickCarStock`).
 * - Todas as 4 URLs de imagem são strings não-vazias (logo pode ser data URI
 *   em fallback catastrófico).
 *
 * O pipeline NUNCA lança — em catastrófico failure retorna fallback total
 * (logo monogram base64 inline + cor `#000000` + texto `#FFFFFF` + 3 fotos
 * stock + 6 carros placeholder).
 */
export interface AssetSources {
  /** URL absoluta ou data URI de logo (256×256+ recomendado). */
  logo_url: string;
  /** Cor primária no formato `#rrggbb` (lowercase). */
  primary_color: string;
  /** Texto sobre `primary_color` com contraste WCAG AA ≥ 4.5. */
  text_on_primary: "#FFFFFF" | "#0C0C0C";
  /** URL absoluta da foto principal da home. */
  hero_image_url: string;
  /** URL absoluta da foto da página "Sobre". */
  about_image_url: string;
  /**
   * URL absoluta da foto editorial dedicada do `<HomeTradeinWidget>` (#298).
   * Optional: pipeline `extractBrandAssets` ainda NÃO popula este campo em
   * V1 — segue null por padrão até admin setar manualmente ou regen futura
   * adicionar slot dedicado. Quando null, widget cai no fallback local
   * desacoplado de `about_image_url`.
   */
  tradein_image_url?: string | null;
  /** URL absoluta da foto do hero da página "Contato". */
  contact_hero_image_url: string;
  /** URLs absolutas dos 6 carros placeholder (length === 6 sempre). */
  car_placeholder_urls: string[];
}
