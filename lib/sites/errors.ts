/**
 * Erros tipados do domínio de sites de leads (Phase 7).
 *
 * Mantidos juntos pra ser fácil mapear no caller (`generateLeadSite` em
 * #159) — cada erro carrega contexto estruturado pra observabilidade.
 */

/**
 * Lançado por `generateUniqueSlug` quando, após N tentativas, todas as
 * propostas de slug colidem com registros existentes em `lead_sites.slug`.
 *
 * Carrega:
 *  - `attempts`: quantas tentativas foram feitas (sempre o `MAX_ATTEMPTS`).
 *  - `business_name`: input original — útil pra log/triagem; não vaza dado
 *    sensível porque `business_name` já é público.
 *
 * O caller deve tratar este erro distinguindo de erros de I/O (timeout,
 * RLS, etc.) — colisão de slug em 5 tentativas é, na prática, sinal de
 * espaço de chaves saturado e exige investigação humana.
 */
export class SlugCollisionError extends Error {
  constructor(
    public readonly attempts: number,
    public readonly business_name: string,
  ) {
    super(
      `Failed to generate unique slug for "${business_name}" after ${attempts} attempts`,
    );
    this.name = "SlugCollisionError";
  }
}
