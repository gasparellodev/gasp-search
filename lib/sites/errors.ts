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

/**
 * Códigos discrimináveis para falhas em `generateCopy` (#158).
 *
 * O orquestrador `generateLeadSite` (#159) decide retry com base em
 * `GenerationError.retryable` — não inspecionar `code` diretamente para
 * decisões de retry, ele é só pra log/observabilidade.
 */
export type GenerationErrorCode =
  /** A IA respondeu sem nenhum block `tool_use` (apenas `text` ou vazio). */
  | "no_tool_use"
  /** O `tool_use.input` retornado falhou em `SiteCopySchema.parse`. */
  | "schema_validation"
  /** O SDK Anthropic lançou (network / rate-limit / 5xx / qualquer outro). */
  | "api_error"
  /** Resposta truncada com `stop_reason === 'max_tokens'` antes do tool_use. */
  | "max_tokens"
  /** Fallback defensivo — não deveria ser atingido em runtime normal. */
  | "unknown";

/**
 * Erro tipado lançado por `generateCopy` em qualquer caminho de falha.
 *
 * Contrato com o orquestrador (#159):
 *  - `retryable: true` → safe pra retry com backoff (transient).
 *  - `retryable: false` → falha determinística, retry não muda o resultado.
 *
 * Mapping atual:
 *  - `no_tool_use`     → retryable (modelo pode acertar na próxima)
 *  - `api_error`       → retryable (transient: rate limit, 5xx, network)
 *  - `schema_validation` → não-retryable (output deterministicamente quebrado)
 *  - `max_tokens`      → não-retryable (precisa input menor, não retry)
 *  - `unknown`         → não-retryable (não sabemos se é seguro)
 *
 * `cause` carrega o erro original (e.g., `ZodError`, `Anthropic.APIError`)
 * pra triagem em logs estruturados.
 */
export class GenerationError extends Error {
  constructor(
    public readonly code: GenerationErrorCode,
    public readonly retryable: boolean,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GenerationError";
  }
}
