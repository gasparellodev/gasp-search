import "server-only";

import type { Anthropic } from "@anthropic-ai/sdk";
import { z, ZodError } from "zod";

import { anthropic } from "@/lib/ai/anthropic";
import { SiteCopySchema, type SiteCopy } from "@/types/lead-site";

import { GenerationError } from "./errors";

/**
 * Versão do par (schema, prompt). Bump SEMVER quando:
 *  - `SiteCopySchema` ganha/perde campos.
 *  - `SYSTEM_PROMPT` muda de forma material (não só typo).
 *
 * Persistido em `lead_sites.variables.generation_version` (#159) pra
 * permitir migração offline de sites antigos quando a versão muda.
 */
export const GENERATION_VERSION = "v1.0.0";

/**
 * Modelo Anthropic alvo. Constante exportada (vs `env.ANTHROPIC_MODEL`)
 * porque a copy do gerador de sites é validada contra um shape específico
 * que assume capacidades do Sonnet 4.6 — trocar de modelo deve ser uma
 * decisão consciente que requer re-validação do schema.
 */
export const GENERATION_MODEL = "claude-sonnet-4-6";

/**
 * System prompt do gerador de copy.
 *
 * **REPRODUZIDO VERBATIM do spec mestre §6, linhas 237-251.**
 * Qualquer alteração aqui deve ser acompanhada de:
 *  1. Atualização do spec (mesmo bloco).
 *  2. Bump em `GENERATION_VERSION`.
 *  3. Snapshot test em `tests/unit/lib/sites/generate-copy.test.ts`
 *     (AC6) que extrai o bloco do spec e compara byte-a-byte.
 */
export const SYSTEM_PROMPT = /* md */ `
Você é um copywriter especialista em sites de concessionárias brasileiras.

REGRAS DURAS:
1. Use APENAS fatos fornecidos no input. NUNCA invente histórico, anos de
   experiência, números de carros vendidos, prêmios.
2. Missão/visão/valores: frases genéricas de concessionária honesta.
3. Slogan: 3-7 palavras, sem clichê.
4. about_text: 4 parágrafos curtos (50-90 palavras cada).
5. Carros placeholder: descrições realistas baseadas em modelo+ano+km, sem
   citar opcionais não-informados.
6. home_categories: 3 categorias inferidas do perfil (luxo → "Combustão/
   Híbrido/Elétrico"; popular → "0km/Seminovos/Promoção"; picape →
   "Picapes/4x4/Diesel").

OUTPUT: ferramenta emit_site_copy. PT-BR. Acentuação correta. Sem emojis.
`;

/**
 * Input de `generateCopy`.
 *
 * **Source:** subset textual de `lead_sites.variables` (schema definido em
 * `types/lead-site.ts`, issue #154 / spec §4). O orquestrador #159 é
 * quem montará este payload a partir do lead + brand assets pipeline (#156).
 *
 * Apenas campos textuais que ajudam o prompt — `primary_color` entra como
 * dica de tom (luxo/popular), não como instrução de styling. Cores reais
 * vêm do brand pipeline.
 */
export interface GenerationInput {
  business_name: string;
  business_type: "concessionaria";
  city?: string;
  state?: string;
  /**
   * Hints opcionais sobre o segmento ("luxo", "popular", "picape", ...) —
   * influenciam a escolha de `home_categories` no prompt.
   */
  segment_hints?: string[];
  /**
   * Quantos carros placeholder o orquestrador quer. Hoje a IA emite 4-6
   * (constraint do schema). Caller deve passar valor compatível.
   */
  car_placeholder_count: number;
  /**
   * Cor primária da marca (hex). Usada como hint, não como instrução de
   * render — render usa o valor canônico de `lead_sites.variables`.
   */
  primary_color?: string;
}

const TOOL_NAME = "emit_site_copy";

/**
 * Type guard estrutural pra `tool_use` block sem depender de subtypes
 * específicos do SDK (que mudam entre versões). Retorna shape mínimo
 * estruturalmente compatível com `Anthropic.ToolUseBlock`.
 */
function isToolUseBlock(
  block: unknown,
): block is { type: "tool_use"; input: unknown; name?: string; id?: string } {
  return (
    typeof block === "object" &&
    block !== null &&
    (block as { type?: unknown }).type === "tool_use"
  );
}

/**
 * Gera a copy textual do site via 1 chamada Anthropic Sonnet 4.6 com
 * tool use forçado.
 *
 * **Custo aproximado em prod (não testável em CI):** ~R$0,03-0,06 por site
 * com cache hit no system prompt (spec §6). CI usa mock — custo zero.
 *
 * **Retry:** zero internas. O caller (`generateLeadSite`, #159) decide
 * retry com backoff baseado em `GenerationError.retryable`.
 *
 * @throws {GenerationError} em qualquer falha — ver códigos em `errors.ts`.
 */
export async function generateCopy(
  input: GenerationInput,
): Promise<SiteCopy> {
  const request: Anthropic.MessageCreateParamsNonStreaming = {
    model: GENERATION_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: TOOL_NAME,
        // Zod v4 tem `z.toJSONSchema()` nativo que emite JSON Schema
        // draft-2020-12 com `type: "object"` no root — formato que o
        // Anthropic API exige em `input_schema`. `zod-to-json-schema@3`
        // emitia output vazio em Zod v4, quebrando a chamada com
        // `tools.0.custom.input_schema.type: Field required`.
        input_schema: z.toJSONSchema(
          SiteCopySchema,
        ) as unknown as Anthropic.Tool["input_schema"],
        description:
          "Emite a copy textual do site (slogan, about, missão, etc.).",
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
  };

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create(request);
  } catch (cause) {
    throw new GenerationError(
      "api_error",
      true,
      `Anthropic SDK falhou: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      cause,
    );
  }

  // Defesa em profundidade: max_tokens é checado ANTES de tool_use porque
  // a SDK pode emitir um tool_use parcial junto com stop_reason='max_tokens'
  // (output incompleto). Tratar como max_tokens (não-retryable, precisa
  // input menor).
  if (response.stop_reason === "max_tokens") {
    throw new GenerationError(
      "max_tokens",
      false,
      "Resposta truncada por max_tokens — payload de input grande demais.",
    );
  }

  // `Array.find` com predicate externo não consegue narrowar a union
  // `ContentBlock` do SDK. Cast pra `unknown[]` e narrow manualmente via
  // type guard estrutural — equivalente runtime, type-safe a partir do guard.
  const toolUse = (response.content as unknown[]).find(isToolUseBlock);
  if (!toolUse) {
    throw new GenerationError(
      "no_tool_use",
      true,
      `IA não invocou a tool '${TOOL_NAME}'. stop_reason=${response.stop_reason ?? "null"}`,
    );
  }

  try {
    return SiteCopySchema.parse(toolUse.input);
  } catch (cause) {
    if (cause instanceof ZodError) {
      throw new GenerationError(
        "schema_validation",
        false,
        `tool_use.input não satisfaz SiteCopySchema: ${cause.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
        cause,
      );
    }
    throw new GenerationError(
      "unknown",
      false,
      `Erro inesperado ao validar tool_use.input: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      cause,
    );
  }
}
