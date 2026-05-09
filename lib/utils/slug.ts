/**
 * Helpers puros de string para geração de slugs.
 *
 * Não toca tokens privados nem importa "server-only" — pode ser usado em
 * qualquer ambiente (server / client / edge / test).
 */

const FALLBACK = "lead";

/**
 * Transforma uma string arbitrária em um slug seguro para URL.
 *
 * Pipeline:
 *  1. Normaliza via NFKD e remove diacríticos (acentos, til, cedilha).
 *  2. Lowercase.
 *  3. Substitui qualquer caractere fora de `[a-z0-9]` por hífen.
 *  4. Colapsa hífens consecutivos.
 *  5. Trim hífens das extremidades.
 *  6. Fallback para `'lead'` se o resultado for vazio (input só com emoji,
 *     pontuação, hífens, etc.).
 *
 * Determinístico e síncrono. Usado pelo gerador de slug único em
 * `lib/sites/slug.ts` como base, mas exportado aqui pra ser reusável.
 */
export function slugify(input: string): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // remove combining marks (acentos)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // não-alfanuméricos viram hífen
    .replace(/-+/g, "-") // colapsa hífens consecutivos (defensivo)
    .replace(/^-+|-+$/g, ""); // trim hífens das pontas

  return normalized.length > 0 ? normalized : FALLBACK;
}
