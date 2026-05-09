/**
 * Sanitização de inputs textuais que viram CSS vars no Site Generator
 * (Phase 7).
 *
 * Razão de existir: as cores `primary_color` / `text_on_primary` em
 * `lead_sites.variables` são injetadas em `style="--site-primary: ..."` no
 * `<SitePage>` wrapper. Sem sanitização, um valor malicioso (ex.:
 * `red; background: url(x); /` ou `javascript:alert(1)`) poderia escapar do
 * contexto da CSS var e injetar declarações arbitrárias no CSSOM. Mesmo com
 * a validação Zod no schema `SiteVariables`, defendemos em profundidade — o
 * banco pode ser editado fora do app, e React inline `style` aceita qualquer
 * string.
 *
 * Estratégia: regex estrita para `#RRGGBB` (6 dígitos hex). Qualquer coisa
 * fora disso retorna `DEFAULT_HEX`, garantindo que o CSS final seja sempre
 * uma cor sintaticamente válida.
 */

/** Fallback usado quando o input não passa na validação. */
export const DEFAULT_HEX = "#0C0C0C";

const HEX_RE = /^#[0-9a-f]{6}$/i;

/**
 * Valida e devolve uma cor hex `#RRGGBB`. Em caso de input inválido (formato
 * errado, hex curto, alpha, nome de cor, tentativa de injection), retorna
 * `DEFAULT_HEX`.
 *
 * Esta função NÃO normaliza o case (mantém maiúsculas/minúsculas do input).
 * O schema Zod já força hex válido na escrita; aqui é defesa em profundidade
 * para a leitura do banco.
 */
export function sanitizeHex(input: string): string {
  if (typeof input !== "string") return DEFAULT_HEX;
  return HEX_RE.test(input) ? input : DEFAULT_HEX;
}
