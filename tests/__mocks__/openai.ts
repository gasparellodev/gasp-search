/**
 * Mock factory para `openai` SDK (issue #216 / Sprint 2 #A2).
 *
 * Espelha o uso real em `lib/openai/image-client.ts` — a SDK é consumida
 * via `new OpenAI({apiKey, timeout, maxRetries}).images.generate(request)`.
 *
 * Default success: retorna um base64 PNG 1x1 transparente (fixture). Use
 * helpers `mockOpenAIImageError(code)` para forçar erros tipados (429
 * rate_limited, 400 invalid_size, 400 moderation_blocked, network).
 *
 * ## Como usar (1 — default success)
 *
 * ```ts
 * import { vi } from 'vitest';
 * import {
 *   openaiMock,
 *   resetOpenAIMock,
 *   openaiState,
 *   mockOpenAIImageSuccess,
 * } from '@/tests/__mocks__/openai';
 *
 * vi.mock('openai', () => openaiMock());
 *
 * beforeEach(() => {
 *   resetOpenAIMock();
 *   mockOpenAIImageSuccess();
 * });
 * ```
 *
 * ## Como overridar por test
 *
 * `openaiState.generate` é um `vi.fn()` — chame
 * `.mockResolvedValueOnce(payload)` ou `.mockRejectedValueOnce(err)`
 * para customizar comportamento por test sem recriar o mock.
 *
 * ## Erros tipados (espelhar shape do SDK real)
 *
 * O SDK `openai` lança erros com `.status`, `.code`, `.type` quando a
 * API retorna 4xx/5xx. Os helpers reproduzem esse shape para que
 * `image-client.ts` mapeie pra `ImageGenerationError` corretamente.
 */
import { vi } from "vitest";

interface OpenAIMockState {
  /** vi.fn() que substitui `OpenAI.images.generate`. */
  generate: ReturnType<typeof vi.fn>;
  /** Histórico de args passados ao construtor `new OpenAI(opts)`. */
  constructorOptions: unknown[];
}

const state: OpenAIMockState = {
  generate: vi.fn(),
  constructorOptions: [],
};

export const openaiState = state;

/**
 * 1×1 PNG transparente codificado em base64. Usado como retorno default
 * de sucesso — pequeno o suficiente para não inflar fixtures, válido
 * o suficiente para passar por `Buffer.from(..., 'base64')` no upload.
 */
export const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/**
 * Factory que retorna o módulo mockado. Passe direto para `vi.mock()`:
 *
 * ```ts
 * vi.mock('openai', () => openaiMock());
 * ```
 *
 * O `OpenAI` retornado é uma classe; cada instância expõe
 * `.images.generate` apontando para o `vi.fn()` compartilhado em `state`.
 * Isso permite que tanto `lib/openai/image-client.ts` (singleton) quanto
 * tests que instanciam manualmente compartilhem o mesmo histórico.
 */
export function openaiMock(): { default: new (opts: unknown) => unknown } {
  class OpenAI {
    images = { generate: state.generate };
    constructor(options: unknown) {
      state.constructorOptions.push(options);
    }
  }
  return { default: OpenAI };
}

/**
 * Reseta o mock entre tests. Use em `beforeEach()`.
 */
export function resetOpenAIMock(): void {
  state.generate.mockReset();
  state.constructorOptions = [];
}

/**
 * Configura `images.generate` para retornar um success default com
 * base64 PNG válido. Shape compatível com `OpenAI.Images.ImagesResponse`.
 *
 * Pass `b64` para customizar payload, ou omita para usar `TINY_PNG_B64`.
 */
export function mockOpenAIImageSuccess(b64: string = TINY_PNG_B64): void {
  state.generate.mockResolvedValue({
    created: Math.floor(Date.now() / 1000),
    data: [{ b64_json: b64 }],
  });
}

/**
 * Erro genérico do SDK OpenAI (espelha shape de `OpenAI.APIError`).
 *
 * O `image-client.ts` mapeia esses campos pra `ImageGenerationError.code`.
 * Reproduz o pattern do SDK real (`error.status` + `error.code` +
 * `error.type` + mensagem) sem importar o SDK pra evitar coupling.
 */
export class MockOpenAIError extends Error {
  status: number;
  code: string | null;
  type: string | null;
  constructor(opts: {
    status: number;
    code?: string | null;
    type?: string | null;
    message: string;
  }) {
    super(opts.message);
    this.name = "MockOpenAIError";
    this.status = opts.status;
    this.code = opts.code ?? null;
    this.type = opts.type ?? null;
  }
}

/**
 * Configura `images.generate` para lançar um erro tipado simulando
 * resposta 429 (rate limit) do OpenAI. Retryable.
 */
export function mockOpenAIRateLimit(): void {
  state.generate.mockRejectedValue(
    new MockOpenAIError({
      status: 429,
      code: "rate_limit_exceeded",
      type: "rate_limit",
      message: "Rate limit reached for images",
    }),
  );
}

/**
 * Configura `images.generate` para lançar um erro 400 invalid_size
 * (size custom não suportada pelo modelo). Não-retryable diretamente —
 * caller deve fazer fallback de size automaticamente.
 */
export function mockOpenAIInvalidSize(): void {
  state.generate.mockRejectedValue(
    new MockOpenAIError({
      status: 400,
      code: "invalid_size",
      type: "invalid_request_error",
      message: "Invalid size for this model",
    }),
  );
}

/**
 * Configura `images.generate` para lançar um erro 400 moderation
 * (prompt bloqueado pelo moderation filter). Não-retryable.
 */
export function mockOpenAIModerationBlocked(): void {
  state.generate.mockRejectedValue(
    new MockOpenAIError({
      status: 400,
      code: "moderation_blocked",
      type: "image_generation_user_error",
      message: "Your request was blocked by our moderation system",
    }),
  );
}

/**
 * Configura `images.generate` para lançar um erro 500 transitório.
 * Retryable.
 */
export function mockOpenAIServerError(): void {
  state.generate.mockRejectedValue(
    new MockOpenAIError({
      status: 500,
      code: "server_error",
      type: "server_error",
      message: "Internal server error",
    }),
  );
}
