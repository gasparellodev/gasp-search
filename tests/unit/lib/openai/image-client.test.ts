/**
 * Tests para `lib/openai/image-client.ts` (Phase 7 Sprint 2 #A2, #216).
 *
 * Cobre adapter pattern OpenAI Images API:
 *   - Input validation (Zod refusa prompts inválidos).
 *   - Success path retorna `{b64, model, size, cost_usd}` shape.
 *   - **NÃO passa `response_format`** (regression test do spike bug #1).
 *   - Snapshot pinado: model default = `gpt-image-2-2026-04-21`.
 *   - Erros tipados: 429 → rate_limited+retryable, 408 → timeout+retryable,
 *     400 invalid_size → invalid_size+não-retryable, 400 moderation →
 *     moderation_blocked+não-retryable, 5xx → server_error+retryable.
 *   - Fallback `1792x1024` → `1536x1024` em 400 invalid_size (1 retry).
 *   - Empty data → throws unknown (defensive).
 *   - Pricing table snapshot (catch silent price drift).
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  mockOpenAIImageSuccess,
  mockOpenAIInvalidSize,
  mockOpenAIModerationBlocked,
  mockOpenAIRateLimit,
  mockOpenAIServerError,
  MockOpenAIError,
  openaiMock,
  openaiState,
  resetOpenAIMock,
  TINY_PNG_B64,
} from "@/tests/__mocks__/openai";

vi.mock("openai", () => openaiMock());

beforeEach(() => {
  resetOpenAIMock();
});

afterEach(() => {
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Input validation (Zod)
// ---------------------------------------------------------------------------

describe("generateImage — Zod validation", () => {
  it("rejeita prompt muito curto (< 10 chars)", async () => {
    mockOpenAIImageSuccess();
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();
    await expect(
      mod.generateImage({
        prompt: "hi",
        size: "1024x1024",
        quality: "medium",
      }),
    ).rejects.toThrow();
  });

  it("rejeita size inválido", async () => {
    mockOpenAIImageSuccess();
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();
    await expect(
      mod.generateImage({
        prompt: "a very specific prompt about cars",
        // @ts-expect-error — testando defensive validation
        size: "9999x9999",
        quality: "medium",
      }),
    ).rejects.toThrow();
  });

  it("rejeita quality inválida", async () => {
    mockOpenAIImageSuccess();
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();
    await expect(
      mod.generateImage({
        prompt: "a very specific prompt about cars",
        size: "1024x1024",
        // @ts-expect-error — testando defensive validation
        quality: "ultra",
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("generateImage — happy path", () => {
  it("retorna {b64, model, size, cost_usd} no success", async () => {
    mockOpenAIImageSuccess();
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();

    const r = await mod.generateImage({
      prompt: "professional dealership hero banner showing a luxury SUV",
      size: "1536x1024",
      quality: "medium",
    });

    expect(r.b64).toBe(TINY_PNG_B64);
    expect(r.model).toBe("gpt-image-2-2026-04-21");
    expect(r.size).toBe("1536x1024");
    expect(r.cost_usd).toBeGreaterThan(0);
  });

  it("usa snapshot pinado (gpt-image-2-2026-04-21) por default", async () => {
    mockOpenAIImageSuccess();
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();

    await mod.generateImage({
      prompt: "professional dealership hero banner showing a luxury SUV",
      size: "1024x1024",
      quality: "medium",
    });

    const call = openaiState.generate.mock.calls[0];
    expect(call).toBeTruthy();
    const args = call?.[0] as Record<string, unknown>;
    expect(args.model).toBe("gpt-image-2-2026-04-21");
  });

  it("NÃO passa response_format (spike bug #1 — causa 400 em gpt-image-2)", async () => {
    mockOpenAIImageSuccess();
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();

    await mod.generateImage({
      prompt: "professional dealership hero banner",
      size: "1024x1024",
      quality: "medium",
    });

    const call = openaiState.generate.mock.calls[0];
    const args = call?.[0] as Record<string, unknown>;
    expect(args).not.toHaveProperty("response_format");
  });

  it("respeita override de model (`gpt-image-1-mini` para fallback caller-driven)", async () => {
    mockOpenAIImageSuccess();
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();

    const r = await mod.generateImage({
      prompt: "professional dealership hero banner",
      size: "1024x1024",
      quality: "low",
      model: "gpt-image-1-mini",
    });

    expect(r.model).toBe("gpt-image-1-mini");
    const call = openaiState.generate.mock.calls[0];
    const args = call?.[0] as Record<string, unknown>;
    expect(args.model).toBe("gpt-image-1-mini");
  });

  it("passa n=1 (single image, sem batches)", async () => {
    mockOpenAIImageSuccess();
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();

    await mod.generateImage({
      prompt: "professional dealership hero banner",
      size: "1024x1024",
      quality: "medium",
    });

    const call = openaiState.generate.mock.calls[0];
    const args = call?.[0] as Record<string, unknown>;
    expect(args.n).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Erros tipados
// ---------------------------------------------------------------------------

describe("generateImage — error mapping", () => {
  it("429 → ImageGenerationError {code: rate_limited, retryable: true}", async () => {
    mockOpenAIRateLimit();
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();

    try {
      await mod.generateImage({
        prompt: "professional dealership hero banner",
        size: "1024x1024",
        quality: "medium",
      });
      throw new Error("Expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(mod.ImageGenerationError);
      const e = err as InstanceType<typeof mod.ImageGenerationError>;
      expect(e.code).toBe("rate_limited");
      expect(e.retryable).toBe(true);
      expect(e.status).toBe(429);
    }
  });

  it("400 moderation_blocked → não-retryable", async () => {
    mockOpenAIModerationBlocked();
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();

    try {
      await mod.generateImage({
        prompt: "professional dealership hero banner",
        size: "1024x1024",
        quality: "medium",
      });
      throw new Error("Expected throw");
    } catch (err) {
      const e = err as InstanceType<typeof mod.ImageGenerationError>;
      expect(e.code).toBe("moderation_blocked");
      expect(e.retryable).toBe(false);
    }
  });

  it("5xx → server_error+retryable", async () => {
    mockOpenAIServerError();
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();

    try {
      await mod.generateImage({
        prompt: "professional dealership hero banner",
        size: "1024x1024",
        quality: "medium",
      });
      throw new Error("Expected throw");
    } catch (err) {
      const e = err as InstanceType<typeof mod.ImageGenerationError>;
      expect(e.code).toBe("server_error");
      expect(e.retryable).toBe(true);
    }
  });

  it("timeout (ETIMEDOUT message) → timeout+retryable", async () => {
    openaiState.generate.mockRejectedValueOnce(
      new MockOpenAIError({
        status: 408,
        code: null,
        type: null,
        message: "Request timed out (ETIMEDOUT)",
      }),
    );
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();

    try {
      await mod.generateImage({
        prompt: "professional dealership hero banner",
        size: "1024x1024",
        quality: "medium",
      });
      throw new Error("Expected throw");
    } catch (err) {
      const e = err as InstanceType<typeof mod.ImageGenerationError>;
      expect(e.code).toBe("timeout");
      expect(e.retryable).toBe(true);
    }
  });

  it("erro sem status conhecido → unknown+não-retryable", async () => {
    openaiState.generate.mockRejectedValueOnce(
      new Error("Some random network glitch"),
    );
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();

    try {
      await mod.generateImage({
        prompt: "professional dealership hero banner",
        size: "1024x1024",
        quality: "medium",
      });
      throw new Error("Expected throw");
    } catch (err) {
      const e = err as InstanceType<typeof mod.ImageGenerationError>;
      expect(e.code).toBe("unknown");
      expect(e.retryable).toBe(false);
    }
  });

  it("empty data array → unknown error (defensive)", async () => {
    openaiState.generate.mockResolvedValueOnce({ created: 0, data: [] });
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();

    try {
      await mod.generateImage({
        prompt: "professional dealership hero banner",
        size: "1024x1024",
        quality: "medium",
      });
      throw new Error("Expected throw");
    } catch (err) {
      const e = err as InstanceType<typeof mod.ImageGenerationError>;
      expect(e.code).toBe("unknown");
    }
  });
});

// ---------------------------------------------------------------------------
// Fallback de size (1792x1024 → 1536x1024)
// ---------------------------------------------------------------------------

describe("generateImage — size fallback (1792x1024 → 1536x1024)", () => {
  it("retry com 1536x1024 quando 1792x1024 retorna 400 invalid_size", async () => {
    openaiState.generate
      .mockRejectedValueOnce(
        new MockOpenAIError({
          status: 400,
          code: "invalid_size",
          type: "invalid_request_error",
          message: "Invalid size 1792x1024",
        }),
      )
      .mockResolvedValueOnce({
        created: 0,
        data: [{ b64_json: TINY_PNG_B64 }],
      });

    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();

    const r = await mod.generateImage({
      prompt: "professional dealership hero banner",
      size: "1792x1024",
      quality: "medium",
    });

    expect(r.size).toBe("1536x1024");
    expect(openaiState.generate).toHaveBeenCalledTimes(2);
    const secondCall = openaiState.generate.mock.calls[1];
    const args = secondCall?.[0] as Record<string, unknown>;
    expect(args.size).toBe("1536x1024");
  });

  it("NÃO faz fallback para sizes diferentes de 1792x1024", async () => {
    mockOpenAIInvalidSize();
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();

    try {
      await mod.generateImage({
        prompt: "professional dealership hero banner",
        size: "1024x1024",
        quality: "medium",
      });
      throw new Error("Expected throw");
    } catch (err) {
      const e = err as InstanceType<typeof mod.ImageGenerationError>;
      expect(e.code).toBe("invalid_size");
      expect(openaiState.generate).toHaveBeenCalledTimes(1);
    }
  });

  it("se fallback também falhar, lança o último erro mapeado", async () => {
    openaiState.generate
      .mockRejectedValueOnce(
        new MockOpenAIError({
          status: 400,
          code: "invalid_size",
          type: "invalid_request_error",
          message: "Invalid size 1792x1024",
        }),
      )
      .mockRejectedValueOnce(
        new MockOpenAIError({
          status: 429,
          code: "rate_limit_exceeded",
          type: "rate_limit",
          message: "Rate limit",
        }),
      );

    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();

    try {
      await mod.generateImage({
        prompt: "professional dealership hero banner",
        size: "1792x1024",
        quality: "medium",
      });
      throw new Error("Expected throw");
    } catch (err) {
      const e = err as InstanceType<typeof mod.ImageGenerationError>;
      expect(e.code).toBe("rate_limited");
      expect(openaiState.generate).toHaveBeenCalledTimes(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Pricing snapshot
// ---------------------------------------------------------------------------

describe("PRICING_USD snapshot", () => {
  it("gpt-image-2 1536x1024 medium = $0.063 (snapshot do spike)", async () => {
    const { PRICING_USD } = await import("@/lib/openai/image-client");
    expect(PRICING_USD["gpt-image-2-2026-04-21"]["1536x1024"].medium).toBe(
      0.063,
    );
  });

  it("gpt-image-2 1024x1024 medium = $0.042", async () => {
    const { PRICING_USD } = await import("@/lib/openai/image-client");
    expect(PRICING_USD["gpt-image-2-2026-04-21"]["1024x1024"].medium).toBe(
      0.042,
    );
  });

  it("gpt-image-1-mini é ~25-30% do custo de gpt-image-2 (medium)", async () => {
    const { PRICING_USD } = await import("@/lib/openai/image-client");
    const mini = PRICING_USD["gpt-image-1-mini"]["1024x1024"].medium;
    const primary = PRICING_USD["gpt-image-2-2026-04-21"]["1024x1024"].medium;
    expect(mini).toBeLessThan(primary * 0.5);
  });
});

// ---------------------------------------------------------------------------
// Singleton config
// ---------------------------------------------------------------------------

describe("getOpenAIClient", () => {
  it("instancia OpenAI com maxRetries: 0 (caller-driven retry)", async () => {
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();
    mod.getOpenAIClient();
    expect(openaiState.constructorOptions).toHaveLength(1);
    const opts = openaiState.constructorOptions[0] as Record<string, unknown>;
    expect(opts.maxRetries).toBe(0);
    expect(opts.timeout).toBe(120_000);
  });

  it("reusa singleton em calls subsequentes", async () => {
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();
    mod.getOpenAIClient();
    mod.getOpenAIClient();
    mod.getOpenAIClient();
    expect(openaiState.constructorOptions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Lazy env validation (QA bloq #1 fix — Vercel/CI build sem OPENAI_API_KEY)
// ---------------------------------------------------------------------------

describe("getOpenAIClient — lazy env validation", () => {
  it("throws clean error quando OPENAI_API_KEY undefined (boot continua, fail só ao usar)", async () => {
    // OPENAI_API_KEY é opcional em lib/env.ts. Build (Vercel preview, CI
    // sem secret) precisa bootar sem o secret. A validação acontece aqui,
    // na primeira tentativa de gerar imagem — não no module boot.
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    vi.resetModules();

    try {
      const mod = await import("@/lib/openai/image-client");
      mod.__resetOpenAIClient();
      expect(() => mod.getOpenAIClient()).toThrow(
        /OPENAI_API_KEY required for image generation/i,
      );
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
      vi.resetModules();
    }
  });

  it("não throws quando OPENAI_API_KEY presente (happy path)", async () => {
    process.env.OPENAI_API_KEY = "sk-openai-test";
    vi.resetModules();
    const mod = await import("@/lib/openai/image-client");
    mod.__resetOpenAIClient();
    expect(() => mod.getOpenAIClient()).not.toThrow();
  });
});
