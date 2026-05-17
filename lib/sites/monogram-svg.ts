/**
 * Pure helper para extrair iniciais do `business_name` para uso em
 * decorações tipográficas server-rendered (hero monogram watermark,
 * `<HomeHeroMonogram />`).
 *
 * Regras (espelham `extractInitials` em `lib/sites/brand-assets.ts` —
 * deliberadamente duplicado para evitar dependência circular com o
 * pipeline de brand-assets v1 que faz hit em Vercel Blob).
 *
 *  - 1 palavra significativa → primeiras 2 letras (single-letter
 *    duplicada quando palavra tem 1 letra só).
 *  - 2+ palavras significativas → primeira letra de cada uma das 2
 *    primeiras.
 *  - Stopwords PT-BR (de / da / do / das / dos / e) e tokens
 *    não-alfabéticos são ignorados.
 *  - Fallback: `XX` quando nada extraível.
 */

const PT_BR_STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e"]);

export function getMonogramInitials(businessName: string): string {
  const tokens = businessName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .map((t) => t.replace(/[^A-Za-z]/g, ""))
    .filter((t) => t.length > 0)
    .filter((t) => !PT_BR_STOPWORDS.has(t.toLowerCase()));

  if (tokens.length === 0) return "XX";
  if (tokens.length === 1) {
    const word = tokens[0]!;
    if (word.length >= 2) return word.slice(0, 2).toUpperCase();
    return (word[0]! + word[0]!).toUpperCase();
  }
  return (tokens[0]![0]! + tokens[1]![0]!).toUpperCase();
}

/**
 * viewBox padronizado para o monogram do hero. Dimensão quadrada com
 * folga para o stroke não cortar nas bordas em escala grande.
 */
export const MONOGRAM_VIEWBOX = "0 0 200 200" as const;

/**
 * Coordenadas do texto centralizado dentro do viewBox.
 * (`text-anchor="middle"` + `dominant-baseline="central"`).
 */
export const MONOGRAM_CENTER = { x: 100, y: 110 } as const;
