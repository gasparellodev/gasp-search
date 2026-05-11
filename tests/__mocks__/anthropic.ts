/**
 * Mock factory para `@anthropic-ai/sdk` (issue #203 / Sprint 0 #F6).
 *
 * Espelha o uso real em `lib/sites/generate-copy.ts` e `lib/ai/anthropic.ts`:
 * a SDK é consumida via `new Anthropic({apiKey}).messages.create(request)`.
 *
 * O padrão dominante no projeto é **tool-use forçado** — a IA responde com
 * um bloco `{type: 'tool_use', input: {...}}` em `response.content`. Este
 * mock entrega esse shape por default e expõe helpers pra customizar
 * payload de tool_use OU para emitir texto (fluxo de `generateMessage`).
 *
 * ## Como usar (1 — default tool-use)
 *
 * ```ts
 * import { vi } from 'vitest';
 * import {
 *   anthropicMock,
 *   mockAnthropicToolUse,
 *   resetAnthropicMock,
 * } from '@/tests/__mocks__/anthropic';
 *
 * vi.mock('@anthropic-ai/sdk', () => anthropicMock());
 *
 * beforeEach(() => {
 *   resetAnthropicMock();
 *   mockAnthropicToolUse({ slogan: 'X', cars: [...] });
 * });
 * ```
 *
 * ## Como usar (2 — text response)
 *
 * ```ts
 * mockAnthropicTextResponse('Olá! Vi seu negócio...');
 * ```
 *
 * ## Como overridar por test
 *
 * `anthropicState.create` é um `vi.fn()` — chame
 * `.mockResolvedValueOnce(customPayload)` ou `.mockRejectedValueOnce(err)`
 * para customizar comportamento por test sem recriar o mock.
 */
import { vi } from "vitest";

interface AnthropicMockState {
  /** vi.fn() que substitui `Anthropic.messages.create`. */
  create: ReturnType<typeof vi.fn>;
  /** Histórico de argumentos passados ao construtor `new Anthropic(opts)`. */
  constructorOptions: unknown[];
}

const state: AnthropicMockState = {
  create: vi.fn(),
  constructorOptions: [],
};

/**
 * Exposes the underlying state — used by tests that need to assert on
 * `.toHaveBeenCalledWith(...)` or inspect the constructor options.
 */
export const anthropicState = state;

/**
 * Factory que retorna o módulo mockado. Passe direto para `vi.mock()`:
 *
 * ```ts
 * vi.mock('@anthropic-ai/sdk', () => anthropicMock());
 * ```
 *
 * O `Anthropic` retornado é uma classe; cada instância expõe
 * `.messages.create` apontando para o `vi.fn()` compartilhado em `state`.
 * Isso permite que tanto `lib/ai/anthropic.ts` (singleton via Proxy) quanto
 * tests que instanciam manualmente compartilhem o mesmo histórico de calls.
 */
export function anthropicMock(): { Anthropic: new (opts: unknown) => unknown } {
  class Anthropic {
    messages = { create: state.create };
    constructor(options: unknown) {
      state.constructorOptions.push(options);
    }
  }
  return { Anthropic };
}

/**
 * Reseta o mock entre tests. Use em `beforeEach()`.
 */
export function resetAnthropicMock(): void {
  state.create.mockReset();
  state.constructorOptions = [];
}

/**
 * Configura `messages.create` para retornar uma resposta padrão de
 * tool_use com o `input` fornecido. Shape compatível com
 * `Anthropic.Messages.Message` para o caminho `tool_use` em
 * `generate-copy.ts`.
 *
 * Por default `tool_name = 'emit_site_copy'` (constante de
 * `lib/sites/generate-copy.ts:TOOL_NAME`); customize se outro caller usa
 * tool diferente.
 */
export function mockAnthropicToolUse(
  toolInput: unknown,
  options: { toolName?: string; toolUseId?: string } = {},
): void {
  const { toolName = "emit_site_copy", toolUseId = "toolu_mock_01" } = options;
  state.create.mockResolvedValue({
    id: "msg_mock_01",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    content: [
      {
        type: "tool_use",
        id: toolUseId,
        name: toolName,
        input: toolInput,
      },
    ],
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 200 },
  });
}

/**
 * Configura `messages.create` para retornar uma resposta de texto puro
 * (sem tool_use). Usado pelo padrão `generateMessage` em
 * `lib/ai/anthropic.ts` que faz `.filter(block => block.type === 'text')`.
 */
export function mockAnthropicTextResponse(text: string): void {
  state.create.mockResolvedValue({
    id: "msg_mock_01",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 50, output_tokens: 80 },
  });
}
