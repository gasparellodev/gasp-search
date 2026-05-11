/**
 * `lib/openai/image-client.ts` — adapter pattern para OpenAI image generation
 * (Phase 7 Sprint 2 #A2, issue #216).
 *
 * Wrapper minimalista em volta de `OpenAI().images.generate(...)` que:
 *
 *   - Mantém singleton lazy (mesma instância por request → cheap re-use).
 *   - Pina modelo via snapshot date (`gpt-image-2-2026-04-21`) por env
 *     `OPENAI_IMAGE_MODEL` — reprodutibilidade de builds.
 *   - **NÃO** passa `response_format` (spike bug #1 — causa 400 em
 *     gpt-image-2; b64 é default).
 *   - **NÃO** lê `revised_prompt` (campo é DALL-E 3 only — gpt-image-2
 *     não emite).
 *   - Mapeia erros do SDK pra `ImageGenerationError` tipado com
 *     `code: 'moderation_blocked' | 'rate_limited' | 'invalid_size' |
 *     'timeout' | 'server_error' | 'unknown'` + `retryable: boolean`.
 *   - Fallback automático de size `1792x1024` → `1536x1024` em erro
 *     `invalid_size` (gpt-image-2 não aceita custom sizes Tier-1).
 *   - SDK config `maxRetries: 0` — caller decide retry via `retryable`.
 *
 * **Não faz fallback de modelo** (`gpt-image-2` → `gpt-image-1-mini`).
 * Esse fallback é responsabilidade do caller em `visual-identity.ts`,
 * que tem acesso a config de spec e custo.
 *
 * Custos hardcoded em `PRICING_USD` (snapshot do spike — atualizar
 * quando OpenAI mudar pricing). Default model: `gpt-image-2-2026-04-21`.
 *
 * **Anti-hallucination**: prompt completo passa direto pro SDK; cleaning
 * é responsabilidade do caller (`visual-identity.ts:buildPrompt`).
 */
import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import { env } from "@/lib/env";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/**
 * Sizes suportadas. Não-quadradas têm pricing especial; presets aceitos
 * pelo gpt-image-2 V1 (snapshot 2026-04-21):
 *   - `1024x1024` (square, default)
 *   - `1536x1024` (landscape 3:2)
 *   - `1024x1536` (portrait 2:3)
 *
 * `1792x1024` aparece em alguns docs como custom — gpt-image-2 retorna
 * 400 `invalid_size` se não suportado. Fallback automático no
 * `generateImage` cai pra `1536x1024`.
 */
export const ImageSizeSchema = z.enum([
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "1792x1024",
]);
export type ImageSize = z.infer<typeof ImageSizeSchema>;

export const ImageQualitySchema = z.enum(["low", "medium", "high"]);
export type ImageQuality = z.infer<typeof ImageQualitySchema>;

export const ImageModelSchema = z.enum([
  "gpt-image-2-2026-04-21",
  "gpt-image-1-mini",
]);
export type ImageModel = z.infer<typeof ImageModelSchema>;

/**
 * Input do `generateImage`. Validado por Zod pré-call (prompt 10-4000 chars).
 */
export const GenerateImageInputSchema = z.object({
  prompt: z.string().trim().min(10).max(4000),
  size: ImageSizeSchema,
  quality: ImageQualitySchema,
  model: ImageModelSchema.optional(),
});
export type GenerateImageInput = z.infer<typeof GenerateImageInputSchema>;

export interface GenerateImageResult {
  /** PNG base64-encoded (sem prefixo `data:image/png;base64,`). */
  b64: string;
  /** Modelo efetivamente usado (depois de eventual fallback). */
  model: ImageModel;
  /** Size efetivamente gerado (depois de fallback 1792→1536). */
  size: ImageSize;
  /** Custo estimado em USD (sourced de `PRICING_USD`). */
  cost_usd: number;
}

/**
 * Códigos de erro emitidos pelo adapter. `retryable: true` significa que
 * o caller pode tentar de novo após backoff (rate_limit, server_error,
 * timeout). `retryable: false` requer mudança de input (moderation,
 * invalid_size depois do fallback, unknown).
 */
export type ImageGenerationErrorCode =
  | "moderation_blocked"
  | "rate_limited"
  | "invalid_size"
  | "timeout"
  | "server_error"
  | "unknown";

export class ImageGenerationError extends Error {
  readonly code: ImageGenerationErrorCode;
  readonly retryable: boolean;
  readonly status: number | null;
  readonly model: ImageModel;
  constructor(opts: {
    code: ImageGenerationErrorCode;
    retryable: boolean;
    message: string;
    status?: number | null;
    model: ImageModel;
  }) {
    super(opts.message);
    this.name = "ImageGenerationError";
    this.code = opts.code;
    this.retryable = opts.retryable;
    this.status = opts.status ?? null;
    this.model = opts.model;
  }
}

// ---------------------------------------------------------------------------
// Pricing table (snapshot do spike `tmp/research/openai-image-spike.md`)
// ---------------------------------------------------------------------------

/**
 * Pricing em USD por imagem (snapshot 2026-04 da OpenAI Images API).
 *
 * **Atualizar quando OpenAI mudar pricing.** Valores conservadores —
 * caller pode somar custos pra cost guardrail no level do site
 * (`estimateTotalCost` em `lib/sites/visual-identity.ts`).
 *
 * Fonte: spike doc + OpenAI pricing page. Valores em $0.0X (centavos
 * USD); 1536x1024 medium é o preset dominante (hero/about/contact).
 */
export const PRICING_USD: Record<
  ImageModel,
  Record<ImageSize, Record<ImageQuality, number>>
> = {
  "gpt-image-2-2026-04-21": {
    "1024x1024": { low: 0.011, medium: 0.042, high: 0.167 },
    "1536x1024": { low: 0.016, medium: 0.063, high: 0.25 },
    "1024x1536": { low: 0.016, medium: 0.063, high: 0.25 },
    "1792x1024": { low: 0.02, medium: 0.08, high: 0.32 },
  },
  "gpt-image-1-mini": {
    "1024x1024": { low: 0.004, medium: 0.011, high: 0.04 },
    "1536x1024": { low: 0.006, medium: 0.016, high: 0.06 },
    "1024x1536": { low: 0.006, medium: 0.016, high: 0.06 },
    "1792x1024": { low: 0.008, medium: 0.021, high: 0.08 },
  },
};

// ---------------------------------------------------------------------------
// Singleton lazy
// ---------------------------------------------------------------------------

let clientSingleton: OpenAI | null = null;

/**
 * Cliente OpenAI compartilhado. Lazy init — primeira call instancia.
 * Tests podem fazer `vi.resetModules()` para limpar entre runs.
 *
 * **`maxRetries: 0`** — caller decide retry via `ImageGenerationError.retryable`
 * (mais previsível que retry exponential interno do SDK).
 */
export function getOpenAIClient(): OpenAI {
  if (!clientSingleton) {
    clientSingleton = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      timeout: 120_000, // 120s — single image pode levar 60-90s
      maxRetries: 0,
    });
  }
  return clientSingleton;
}

/**
 * Reseta o singleton — uso interno em tests. **Não exportado em prod
 * (callers não devem precisar).**
 */
export function __resetOpenAIClient(): void {
  clientSingleton = null;
}

// ---------------------------------------------------------------------------
// Adapter principal
// ---------------------------------------------------------------------------

/**
 * Gera uma imagem via OpenAI Images API. Lança `ImageGenerationError`
 * tipado em qualquer falha — caller decide retry/fallback baseado em
 * `error.retryable`.
 *
 * **Pipeline:**
 *   1. Valida input via Zod (lança ZodError em violação — bug do caller).
 *   2. Resolve modelo: `input.model ?? env.OPENAI_IMAGE_MODEL`.
 *   3. Chama `openai.images.generate(...)` (SEM response_format).
 *   4. Em 400 invalid_size com size `1792x1024` → fallback `1536x1024`
 *      automático (1 retry).
 *   5. Em qualquer outro erro do SDK → mapeia pra `ImageGenerationError`.
 *   6. Em sucesso → retorna `{b64, model, size, cost_usd}`.
 */
export async function generateImage(
  input: GenerateImageInput,
): Promise<GenerateImageResult> {
  const validated = GenerateImageInputSchema.parse(input);
  const model = (validated.model ??
    (env.OPENAI_IMAGE_MODEL as ImageModel)) as ImageModel;

  try {
    return await callApi({
      prompt: validated.prompt,
      size: validated.size,
      quality: validated.quality,
      model,
    });
  } catch (err) {
    const mapped = mapError(err, model);
    // Fallback automático: invalid_size com 1792x1024 → 1536x1024.
    if (
      mapped.code === "invalid_size" &&
      validated.size === "1792x1024"
    ) {
      try {
        return await callApi({
          prompt: validated.prompt,
          size: "1536x1024",
          quality: validated.quality,
          model,
        });
      } catch (err2) {
        throw mapError(err2, model);
      }
    }
    throw mapped;
  }
}

interface CallApiArgs {
  prompt: string;
  size: ImageSize;
  quality: ImageQuality;
  model: ImageModel;
}

async function callApi(args: CallApiArgs): Promise<GenerateImageResult> {
  const client = getOpenAIClient();

  // **NÃO passar `response_format`** — gpt-image-2 retorna b64 por default
  // e rejeita `response_format` com 400 (spike bug #1).
  const response = await client.images.generate({
    model: args.model,
    prompt: args.prompt,
    size: args.size,
    quality: args.quality,
    n: 1,
  });

  const dataArr = (response as { data?: Array<{ b64_json?: string }> }).data;
  const first = dataArr?.[0];
  if (!first?.b64_json) {
    throw new ImageGenerationError({
      code: "unknown",
      retryable: false,
      message: "OpenAI returned empty data array (no b64_json)",
      status: null,
      model: args.model,
    });
  }

  return {
    b64: first.b64_json,
    model: args.model,
    size: args.size,
    cost_usd: PRICING_USD[args.model][args.size][args.quality],
  };
}

// ---------------------------------------------------------------------------
// Mapeamento de erros do SDK
// ---------------------------------------------------------------------------

interface SdkErrorShape {
  status?: number;
  code?: string | null;
  type?: string | null;
  message?: string;
  name?: string;
}

/**
 * Mapeia erro do SDK OpenAI (`OpenAI.APIError`) pra `ImageGenerationError`
 * tipado. Defensive — qualquer formato inesperado vira `unknown` (não-retryable).
 *
 * Reglas:
 *   - 429 → `rate_limited`, retryable.
 *   - 408 / `ECONNABORTED` / `ETIMEDOUT` → `timeout`, retryable.
 *   - 400 `code: 'invalid_size'` ou message contém `'size'` → `invalid_size`,
 *     **retryable=false** (caller faz fallback, não retry).
 *   - 400 `code: 'moderation_blocked'` ou `type: 'image_generation_user_error'`
 *     ou message contém `'moderation'` → `moderation_blocked`, não-retryable.
 *   - 5xx → `server_error`, retryable.
 *   - resto → `unknown`, não-retryable.
 */
function mapError(err: unknown, model: ImageModel): ImageGenerationError {
  if (err instanceof ImageGenerationError) return err;

  const sdkErr = err as SdkErrorShape;
  const status = typeof sdkErr.status === "number" ? sdkErr.status : null;
  const code = typeof sdkErr.code === "string" ? sdkErr.code : null;
  const type = typeof sdkErr.type === "string" ? sdkErr.type : null;
  const message = typeof sdkErr.message === "string" ? sdkErr.message : "";
  const messageLc = message.toLowerCase();

  // 429 rate limit
  if (status === 429 || code === "rate_limit_exceeded") {
    return new ImageGenerationError({
      code: "rate_limited",
      retryable: true,
      message: message || "Rate limit exceeded",
      status,
      model,
    });
  }

  // Timeout
  if (
    status === 408 ||
    sdkErr.name === "APIConnectionTimeoutError" ||
    messageLc.includes("timeout") ||
    messageLc.includes("etimedout")
  ) {
    return new ImageGenerationError({
      code: "timeout",
      retryable: true,
      message: message || "Request timed out",
      status,
      model,
    });
  }

  // 400 invalid_size — não-retryable (fallback handled by caller layer)
  if (
    status === 400 &&
    (code === "invalid_size" || messageLc.includes("size"))
  ) {
    return new ImageGenerationError({
      code: "invalid_size",
      retryable: false,
      message: message || "Invalid size for model",
      status,
      model,
    });
  }

  // 400 moderation
  if (
    status === 400 &&
    (code === "moderation_blocked" ||
      type === "image_generation_user_error" ||
      messageLc.includes("moderation") ||
      messageLc.includes("blocked"))
  ) {
    return new ImageGenerationError({
      code: "moderation_blocked",
      retryable: false,
      message: message || "Request blocked by moderation",
      status,
      model,
    });
  }

  // 5xx server error
  if (status !== null && status >= 500) {
    return new ImageGenerationError({
      code: "server_error",
      retryable: true,
      message: message || "Server error",
      status,
      model,
    });
  }

  // Unknown
  return new ImageGenerationError({
    code: "unknown",
    retryable: false,
    message: message || "Unknown error",
    status,
    model,
  });
}
