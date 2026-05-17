import "server-only";

import type { Anthropic } from "@anthropic-ai/sdk";
import { z, ZodError } from "zod";

import { anthropic } from "@/lib/ai/anthropic";
import type { FaqEntry } from "@/lib/sites/faq-template";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Número alvo de FAQs geradas por chamada. Alinhado com `FAQ_TEMPLATE`
 * (8 entradas) e com o requisito PO de "≥ 8 perguntas via Server Action".
 *
 * Constante exportada para permitir que testes e callers referenciem o
 * valor canônico sem hardcodar o número.
 */
export const FAQS_TARGET_COUNT = 8;

const FAQ_TOOL_NAME = "emit_faqs";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const FaqItemSchema = z.object({
  question: z.string().min(5).max(200),
  answer: z.string().min(20).max(800),
});

const FaqsOutputSchema = z.object({
  faqs: z.array(FaqItemSchema).length(FAQS_TARGET_COUNT),
});

// ---------------------------------------------------------------------------
// Typed error
// ---------------------------------------------------------------------------

export type FaqGenerationErrorCode =
  /** SDK Anthropic lançou (network / rate-limit / 5xx). */
  | "api_error"
  /** `tool_use.input` não passou na validação Zod. */
  | "schema_validation"
  /** A IA respondeu sem nenhum block `tool_use`. */
  | "no_tool_use"
  /** Fallback defensivo — não deve ser atingido em runtime normal. */
  | "unknown";

/**
 * Erro tipado lançado por `generateFaqContent` em qualquer caminho de falha.
 *
 * Contrato com o caller (`generateFAQ` Server Action):
 *  - `retryable: true`  → safe pra retry com backoff (transient).
 *  - `retryable: false` → falha determinística; retry não muda o resultado.
 */
export class FaqGenerationError extends Error {
  constructor(
    public readonly code: FaqGenerationErrorCode,
    public readonly retryable: boolean,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "FaqGenerationError";
  }
}

// ---------------------------------------------------------------------------
// Input interface
// ---------------------------------------------------------------------------

/**
 * Input de `generateFaqContent`.
 *
 * Derivado de `SiteVariablesV2` pelo Server Action (`generateFAQ`).
 * Apenas campos textuais relevantes pro prompt — sem PII de leads.
 */
export interface GenerateFaqInput {
  /** Nome público da concessionária. */
  business_name: string;
  /** Lista deduplicated das marcas no estoque (de `cars[].brand`). */
  brands: string[];
  /** Cidade da loja (nullable quando `address` é null em V2). */
  city: string | null;
  /** UF de 2 letras (nullable quando `address` é null em V2). */
  state: string | null;
  /**
   * Resumo textual da garantia oferecida, se disponível em `variables`.
   * V1: não existe campo canônico — passar `null`. Adicionado pra
   * compatibilidade futura quando o schema ganhar campo de garantia.
   */
  warranty_summary?: string | null;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

/**
 * System prompt do gerador de FAQ.
 *
 * Anti-hallucination: "APENAS dados do input" instrui o modelo a não
 * inventar serviços, garantias, financiamento ou outros atributos que
 * não foram explicitamente fornecidos no contexto.
 */
export const SYSTEM_PROMPT_FAQ = `Você é especialista em copywriting de FAQ para concessionárias brasileiras de carros seminovos.

REGRAS OBRIGATÓRIAS:
1. Gere exatamente ${FAQS_TARGET_COUNT} perguntas + respostas em PT-BR.
2. Use APENAS os dados fornecidos no input — NUNCA invente serviços, garantias, formas de financiamento ou outros atributos não mencionados.
3. Perguntas: 5-200 caracteres. Respostas: 20-800 caracteres.
4. Cobertura típica: garantia, financiamento, troca/avaliação, vistoria, procedência, agendamento, documentação, formas de pagamento.
5. Tom: direto, confiante, sem juridiquês excessivo.
6. Acentuação PT-BR correta. Sem emojis.

OUTPUT: ferramenta ${FAQ_TOOL_NAME}. Sem texto fora da ferramenta.`;

// ---------------------------------------------------------------------------
// Type guard (mirror do pattern em generate-copy.ts)
// ---------------------------------------------------------------------------

function isToolUseBlock(
  block: unknown,
): block is { type: "tool_use"; input: unknown; name?: string; id?: string } {
  return (
    typeof block === "object" &&
    block !== null &&
    (block as { type?: unknown }).type === "tool_use"
  );
}

// ---------------------------------------------------------------------------
// Core helper
// ---------------------------------------------------------------------------

/**
 * Gera 8 FAQs PT-BR para uma concessionária via 1 chamada Anthropic
 * Sonnet 4.6 com tool use forçado (`emit_faqs`).
 *
 * **Sem retry interno.** O caller (`generateFAQ` Server Action) decide
 * retry com base em `FaqGenerationError.retryable`.
 *
 * **Sem DB write.** Retorna o array validado — persistência é
 * responsabilidade do caller (follow-up issue necessário para adicionar
 * coluna `lead_sites.faq_generated` ou campo em `SiteVariablesV2`).
 *
 * @throws {FaqGenerationError} em qualquer falha — ver `FaqGenerationErrorCode`.
 */
export async function generateFaqContent(
  input: GenerateFaqInput,
): Promise<FaqEntry[]> {
  const userMessage = [
    `Dados da concessionária:`,
    `- Nome: ${input.business_name}`,
    `- Localização: ${input.city ?? "Brasil"}${input.state ? `, ${input.state}` : ""}`,
    `- Marcas no estoque: ${input.brands.length > 0 ? input.brands.join(", ") : "Variadas"}`,
    ...(input.warranty_summary
      ? [`- Garantia oferecida: ${input.warranty_summary}`]
      : []),
    ``,
    `Gere ${FAQS_TARGET_COUNT} FAQs para esta concessionária.`,
  ].join("\n");

  let response: Awaited<ReturnType<typeof anthropic.messages.create>>;
  try {
    response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT_FAQ,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          name: FAQ_TOOL_NAME,
          description:
            "Emite o array de perguntas e respostas validado da FAQ.",
          // Zod v4 nativo: `z.toJSONSchema()` emite JSON Schema draft-2020-12
          // com `type: "object"` no root — formato exigido pelo Anthropic API
          // em `input_schema`. `zod-to-json-schema@3` quebra com Zod v4.
          input_schema: z.toJSONSchema(
            FaqsOutputSchema,
          ) as unknown as Anthropic.Tool["input_schema"],
        },
      ],
      tool_choice: { type: "tool", name: FAQ_TOOL_NAME },
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });
  } catch (cause) {
    throw new FaqGenerationError(
      "api_error",
      true,
      `Anthropic SDK falhou: ${cause instanceof Error ? cause.message : String(cause)}`,
      cause,
    );
  }

  // Defesa: verifica max_tokens antes de inspecionar tool_use (output pode
  // estar truncado — mesmo padrão de generate-copy.ts).
  if (response.stop_reason === "max_tokens") {
    throw new FaqGenerationError(
      "no_tool_use",
      true,
      "Resposta truncada por max_tokens antes do tool_use — retry com input menor.",
    );
  }

  const toolUse = (response.content as unknown[]).find(isToolUseBlock);
  if (!toolUse) {
    throw new FaqGenerationError(
      "no_tool_use",
      true,
      `IA não invocou a tool '${FAQ_TOOL_NAME}'. stop_reason=${response.stop_reason ?? "null"}`,
    );
  }

  try {
    const parsed = FaqsOutputSchema.parse(toolUse.input);
    return parsed.faqs;
  } catch (cause) {
    if (cause instanceof ZodError) {
      throw new FaqGenerationError(
        "schema_validation",
        false,
        `tool_use.input não satisfaz FaqsOutputSchema: ${cause.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
        cause,
      );
    }
    throw new FaqGenerationError(
      "unknown",
      false,
      `Erro inesperado ao validar tool_use.input: ${cause instanceof Error ? cause.message : String(cause)}`,
      cause,
    );
  }
}
