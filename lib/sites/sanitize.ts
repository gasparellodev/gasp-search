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

/**
 * Whitelist de schemes aceitos como URL pública. Qualquer outro scheme
 * (`javascript:`, `data:`, `file:`, `vbscript:`, `gopher:`, ...) é
 * tratado como input adversarial — `safeUrl` retorna `null`.
 *
 * `http:` é mantido pra suportar dev/local sem TLS. Em produção, brand
 * assets reais sempre virão de fontes https (Vercel Blob, CDNs Apify).
 */
const URL_SCHEME_WHITELIST = new Set(["http:", "https:"]);

/**
 * Valida e devolve uma URL pública segura ou `null`.
 *
 * Razão de existir: o pipeline de brand assets (#156) retorna URLs de
 * fontes externas (Instagram, Google Maps, scraping de favicon, Vercel
 * Blob). Em catastrófico, alguma fonte poderia retornar uma string com
 * scheme malicioso (`javascript:`, `data:image/svg+xml;...`, ...) que
 * seria injetada em `<img src=...>` ou `style="background-image: url(...)"`.
 * `safeUrl` é a defesa em profundidade no orquestrador `generateLeadSite`
 * (#159) — qualquer URL não-http(s) vira `null`, e o caller substitui
 * por fallback (monogram inline / stock photo).
 *
 * Validação:
 *  1. Tipo `string` (defesa contra `null`/`undefined`/numeric ts-bypass).
 *  2. Construtor `URL` aceita o input (forma sintática válida).
 *  3. `protocol` está em `URL_SCHEME_WHITELIST`.
 *
 * Reaproveitamos o `URL` parser do runtime — testes contra
 * `javascript:alert(1)` (que parseia mas tem `protocol === 'javascript:'`)
 * passam pelo guard 1+2 mas falham no 3.
 */
export function safeUrl(input: string | null | undefined): string | null {
  if (typeof input !== "string" || input.length === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }
  return URL_SCHEME_WHITELIST.has(parsed.protocol.toLowerCase())
    ? input
    : null;
}
