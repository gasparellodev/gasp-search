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

/**
 * Limite máximo de caracteres do `announcement_text` exibido no
 * `<AnnouncementBar>` (Phase 7 / WP2 — issue #291). Mesmo limite que o
 * schema Zod (`types/visual-identity.ts`).
 */
export const ANNOUNCEMENT_TEXT_MAX = 140;

/**
 * Tag HTML mais simples possível (`<...>`). Usada pra strippar tags de
 * `announcement_text` antes de renderizar como texto. Não cobre todos os
 * vetores (entities, code points obscuros), mas como render final usa
 * children React (não dangerouslySetInnerHTML) o risco real é zero — esta
 * sanitização é defesa em profundidade contra strings absurdas vindas do
 * banco / admin.
 */
const HTML_TAG_RE = /<[^>]*>/g;

/**
 * Normaliza o texto do `<AnnouncementBar>` (#291).
 *
 * Pipeline:
 *  1. Rejeita não-string (`null`/`undefined`/number) → `null`.
 *  2. Strip de tags HTML simples (defesa em profundidade).
 *  3. Trim de whitespace nas pontas.
 *  4. Colapsa whitespace interno (incluindo \n, \t) em 1 espaço — marquee
 *     em 1 linha; quebras explícitas no banco viraram espaço.
 *  5. Trunca a `ANNOUNCEMENT_TEXT_MAX` chars (pós-trim).
 *  6. String vazia → `null` (o componente decide não renderizar).
 *
 * Retorna `string | null` pra simplificar o caller: se houver texto válido,
 * renderiza; senão, retorna `null` da function `<AnnouncementBar>` antes de
 * montar markup.
 */
export function sanitizeAnnouncementText(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const stripped = input.replace(HTML_TAG_RE, "");
  const collapsed = stripped.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return null;
  return collapsed.length > ANNOUNCEMENT_TEXT_MAX
    ? collapsed.slice(0, ANNOUNCEMENT_TEXT_MAX)
    : collapsed;
}
