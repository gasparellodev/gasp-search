import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { SiteCopySchema, type SiteCopy } from "@/types/lead-site";

// ---------------------------------------------------------------------------
// Test env (mirrored from anthropic.test.ts pattern)
// ---------------------------------------------------------------------------

const VALID_ENV = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  APIFY_TOKEN: "t",
  APIFY_GOOGLE_MAPS_ACTOR_ID: "compass~crawler-google-places",
  APIFY_INSTAGRAM_ACTOR_ID: "apify~instagram-scraper",
  APIFY_WEBSITE_CONTACT_ACTOR_ID: "vdrmota~contact-info-scraper",
  ANTHROPIC_API_KEY: "sk-ant-test",
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
} as const;

// ---------------------------------------------------------------------------
// Anthropic SDK mock — CI never hits the real API. AC8 / §5 (BLOQUEANTE).
// ---------------------------------------------------------------------------

const anthropicMock = vi.hoisted(() => ({
  create: vi.fn(),
  constructorOptions: [] as unknown[],
}));

vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    messages = { create: anthropicMock.create };
    constructor(options: unknown) {
      anthropicMock.constructorOptions.push(options);
    }
  }
  return { Anthropic };
});

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  Object.assign(process.env, VALID_ENV);
  anthropicMock.create.mockReset();
  anthropicMock.constructorOptions = [];
  vi.resetModules();
});

afterEach(() => {
  process.env = savedEnv;
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeValidSiteCopy(): SiteCopy {
  return {
    slogan: "Sua próxima conquista nas quatro rodas",
    home_categories: [
      { label: "0km" },
      { label: "Seminovos" },
      { label: "Promoção" },
    ],
    emphasis: {
      title: "Destaque do mês",
      description:
        "Modelo recém-chegado, revisado e pronto pra rodar. Documentação em dia, garantia estendida e financiamento facilitado pra você sair dirigindo hoje mesmo, sem complicação e com a confiança da nossa equipe.",
    },
    about_text:
      "Somos uma concessionária familiar com paixão por carros e respeito por gente. Nosso compromisso é oferecer veículos revisados, com procedência clara e atendimento honesto.\n\nCada cliente é tratado como parte da nossa história. Da escolha do modelo à assinatura do contrato, queremos que você se sinta em casa.\n\nTrabalhamos com financeiras parceiras pra que o sonho do carro novo caiba no seu bolso. Simulação rápida e sem pegadinhas.\n\nPós-venda ativo: revisamos, lavamos e acompanhamos cada veículo que sai daqui. Confiança que constrói relacionamento de longo prazo.",
    mission:
      "Tornar a compra do próximo carro uma experiência transparente, ágil e humana, com atendimento de verdade.",
    vision:
      "Ser referência regional em concessionária familiar, conhecida pela honestidade no negócio e cuidado pós-venda.",
    values: [
      "Honestidade em cada negociação",
      "Respeito pelo cliente",
      "Procedência clara nos veículos",
      "Atendimento humano e direto",
    ],
    cars: [
      {
        description:
          "Sedan compacto bem cuidado, ideal pra cidade. Manutenção em dia, ar-condicionado gelado, direção elétrica e bom espaço interno. Pneus em ótimo estado e revisão preventiva recente.",
        datasheet: [
          ["Câmbio", "Manual"],
          ["Combustível", "Flex"],
        ],
        featured: true,
      },
      {
        description:
          "Hatch ágil e econômico, perfeito pro dia a dia urbano. Vidros elétricos, travas, alarme e som original. Documentação em dia, sem nenhum sinistro registrado no histórico.",
        datasheet: [
          ["Câmbio", "Automático"],
          ["Combustível", "Gasolina"],
        ],
        featured: false,
      },
      {
        description:
          "SUV familiar com ótimo porta-malas e altura elevada. Ar digital, multimídia com câmera de ré, bancos em couro e sensor de estacionamento. Pneus novos, ideal pra viagem.",
        datasheet: [
          ["Câmbio", "Automático"],
          ["Combustível", "Flex"],
        ],
        featured: false,
      },
      {
        description:
          "Picape robusta com tração 4x4, perfeita pra trabalho pesado e fim de semana na fazenda. Caçamba protegida, engate reboque, faróis de neblina e revisão recente.",
        datasheet: [
          ["Câmbio", "Manual"],
          ["Tração", "4x4"],
        ],
        featured: false,
      },
    ],
  };
}

function makeValidInput() {
  return {
    business_name: "Auto Center Brasil",
    business_type: "concessionaria" as const,
    city: "Recife",
    state: "PE",
    segment_hints: ["popular", "familiar"],
    car_placeholder_count: 4,
    primary_color: "#1A4FB0",
  };
}

// Stub helpers for messages.create response shape
function toolUseResponse(input: unknown) {
  return {
    stop_reason: "tool_use",
    content: [
      {
        type: "tool_use",
        id: "tool-1",
        name: "emit_site_copy",
        input,
      },
    ],
  };
}

function textOnlyResponse() {
  return {
    stop_reason: "end_turn",
    content: [{ type: "text", text: "Não consegui invocar a ferramenta." }],
  };
}

function maxTokensResponse() {
  return {
    stop_reason: "max_tokens",
    content: [{ type: "text", text: "Output truncado..." }],
  };
}

// ---------------------------------------------------------------------------
// SYSTEM_PROMPT extraction from spec (§6, lines 237-251) — byte-exact.
// ---------------------------------------------------------------------------

function extractSystemPromptFromSpec(): string {
  const specPath = path.resolve(
    __dirname,
    "../../../..",
    "docs/superpowers/specs/2026-05-08-gerador-sites-concessionarias-design.md",
  );
  const raw = readFileSync(specPath, "utf-8");
  // Match the markdown-tagged template literal:
  //   const SYSTEM_PROMPT = /* md */ `...`;
  // capturing the inner content verbatim (multiline, non-greedy).
  const m = raw.match(/const SYSTEM_PROMPT = \/\* md \*\/ `([\s\S]*?)`;/);
  if (!m || !m[1]) {
    throw new Error(
      "Não foi possível extrair SYSTEM_PROMPT do spec — pattern mudou?",
    );
  }
  return m[1];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateCopy()", () => {
  describe("AC1 — Happy path", () => {
    it("retorna SiteCopy validado quando IA emite tool_use com input válido", async () => {
      const expectedCopy = makeValidSiteCopy();
      anthropicMock.create.mockResolvedValue(toolUseResponse(expectedCopy));

      const { generateCopy } = await import("@/lib/sites/generate-copy");

      const result = await generateCopy(makeValidInput());

      expect(result).toEqual(expectedCopy);
      // Re-validate via Zod just to confirm the contract
      expect(() => SiteCopySchema.parse(result)).not.toThrow();
    });

    it("invoca anthropic.messages.create com model, cache_control, tool_choice e tools corretos", async () => {
      anthropicMock.create.mockResolvedValue(
        toolUseResponse(makeValidSiteCopy()),
      );

      const { generateCopy, GENERATION_MODEL } = await import(
        "@/lib/sites/generate-copy"
      );
      const { default: zodToJsonSchema } = await import("zod-to-json-schema");

      await generateCopy(makeValidInput());

      expect(anthropicMock.create).toHaveBeenCalledTimes(1);
      const [request] = anthropicMock.create.mock.calls[0] as [
        Record<string, unknown>,
      ];

      // model
      expect(request.model).toBe(GENERATION_MODEL);
      expect(request.model).toBe("claude-sonnet-4-6");

      // system[0].cache_control.type === 'ephemeral'
      expect(Array.isArray(request.system)).toBe(true);
      const system = request.system as Array<{
        type: string;
        text: string;
        cache_control: { type: string };
      }>;
      expect(system[0]?.type).toBe("text");
      expect(system[0]?.cache_control).toEqual({ type: "ephemeral" });

      // tool_choice
      expect(request.tool_choice).toEqual({
        type: "tool",
        name: "emit_site_copy",
      });

      // tools[0].name + input_schema deep-equal zodToJsonSchema(SiteCopySchema)
      const tools = request.tools as Array<{
        name: string;
        input_schema: unknown;
      }>;
      expect(tools).toHaveLength(1);
      expect(tools[0]?.name).toBe("emit_site_copy");
      // Cast como o módulo faz — zod-to-json-schema@3.x foi tipado pra Zod v3
      // mas runtime funciona em v4. Comparação é do valor produzido, não do
      // schema input.
      expect(tools[0]?.input_schema).toEqual(
        zodToJsonSchema(
          SiteCopySchema as unknown as Parameters<typeof zodToJsonSchema>[0],
        ),
      );
    });

    it("envia o input do caller serializado em messages[0].content", async () => {
      anthropicMock.create.mockResolvedValue(
        toolUseResponse(makeValidSiteCopy()),
      );

      const { generateCopy } = await import("@/lib/sites/generate-copy");
      const input = makeValidInput();
      await generateCopy(input);

      const [request] = anthropicMock.create.mock.calls[0] as [
        Record<string, unknown>,
      ];
      const messages = request.messages as Array<{
        role: string;
        content: unknown;
      }>;
      expect(messages).toHaveLength(1);
      expect(messages[0]?.role).toBe("user");
      // Spec: content é JSON.stringify(leadData). Permitimos string OU array
      // de blocks de texto pra alinhar com SDK type. Validamos que carrega
      // os campos do input.
      const serialized =
        typeof messages[0]?.content === "string"
          ? messages[0]?.content
          : JSON.stringify(messages[0]?.content);
      expect(serialized).toContain("Auto Center Brasil");
      expect(serialized).toContain("concessionaria");
      expect(serialized).toContain("Recife");
    });
  });

  describe("AC2 — sem tool_use", () => {
    it("lança GenerationError com code='no_tool_use' e retryable=true", async () => {
      anthropicMock.create.mockResolvedValue(textOnlyResponse());

      const { generateCopy } = await import("@/lib/sites/generate-copy");
      const { GenerationError } = await import("@/lib/sites/errors");

      await expect(generateCopy(makeValidInput())).rejects.toMatchObject({
        name: "GenerationError",
        code: "no_tool_use",
        retryable: true,
      });

      // Reset and re-run for instanceof check
      anthropicMock.create.mockResolvedValue(textOnlyResponse());
      const err = await generateCopy(makeValidInput()).catch((e) => e);
      expect(err).toBeInstanceOf(GenerationError);
    });
  });

  describe("AC3 — schema validation", () => {
    it("lança GenerationError com code='schema_validation', retryable=false e cause=ZodError", async () => {
      // Falta `cars` (cars: array min(4)). Garantido a falhar em SiteCopySchema.
      const invalidCopy = {
        slogan: "Curto",
        home_categories: [],
      };
      anthropicMock.create.mockResolvedValue(toolUseResponse(invalidCopy));

      const { generateCopy } = await import("@/lib/sites/generate-copy");
      const { GenerationError } = await import("@/lib/sites/errors");

      const err = await generateCopy(makeValidInput()).catch((e) => e);
      expect(err).toBeInstanceOf(GenerationError);
      expect(err.code).toBe("schema_validation");
      expect(err.retryable).toBe(false);
      expect(err.cause).toBeInstanceOf(ZodError);
    });
  });

  describe("AC4 — API error", () => {
    it("lança GenerationError com code='api_error', retryable=true e cause original", async () => {
      const original = new Error("rate limit");
      anthropicMock.create.mockRejectedValue(original);

      const { generateCopy } = await import("@/lib/sites/generate-copy");
      const { GenerationError } = await import("@/lib/sites/errors");

      const err = await generateCopy(makeValidInput()).catch((e) => e);
      expect(err).toBeInstanceOf(GenerationError);
      expect(err.code).toBe("api_error");
      expect(err.retryable).toBe(true);
      expect(err.cause).toBe(original);
    });
  });

  describe("AC5 — max_tokens", () => {
    it("lança GenerationError com code='max_tokens' e retryable=false", async () => {
      anthropicMock.create.mockResolvedValue(maxTokensResponse());

      const { generateCopy } = await import("@/lib/sites/generate-copy");
      const { GenerationError } = await import("@/lib/sites/errors");

      const err = await generateCopy(makeValidInput()).catch((e) => e);
      expect(err).toBeInstanceOf(GenerationError);
      expect(err.code).toBe("max_tokens");
      expect(err.retryable).toBe(false);
    });
  });

  describe("AC6 — SYSTEM_PROMPT byte-exact com spec §6", () => {
    it("SYSTEM_PROMPT corresponde literalmente ao bloco do spec mestre", async () => {
      const fromSpec = extractSystemPromptFromSpec();
      const { SYSTEM_PROMPT } = await import("@/lib/sites/generate-copy");

      expect(SYSTEM_PROMPT).toBe(fromSpec);
    });

    it("SYSTEM_PROMPT é enviado em request.system[0].text", async () => {
      anthropicMock.create.mockResolvedValue(
        toolUseResponse(makeValidSiteCopy()),
      );
      const { generateCopy, SYSTEM_PROMPT } = await import(
        "@/lib/sites/generate-copy"
      );
      await generateCopy(makeValidInput());

      const [request] = anthropicMock.create.mock.calls[0] as [
        Record<string, unknown>,
      ];
      const system = request.system as Array<{ text: string }>;
      expect(system[0]?.text).toBe(SYSTEM_PROMPT);
    });
  });

  describe("AC7 — exports", () => {
    it("exporta generateCopy, GENERATION_VERSION, GENERATION_MODEL e SYSTEM_PROMPT", async () => {
      const mod = await import("@/lib/sites/generate-copy");
      expect(typeof mod.generateCopy).toBe("function");
      expect(mod.GENERATION_VERSION).toBe("v1.0.0");
      expect(mod.GENERATION_MODEL).toBe("claude-sonnet-4-6");
      expect(typeof mod.SYSTEM_PROMPT).toBe("string");
      expect(mod.SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });

    it("errors.ts exporta GenerationError e o tipo GenerationErrorCode existe (compile-time)", async () => {
      const mod = await import("@/lib/sites/errors");
      expect(typeof mod.GenerationError).toBe("function");
      // Smoke: instanciar e checar shape
      const err = new mod.GenerationError(
        "unknown",
        false,
        "boom",
        new Error("cause"),
      );
      expect(err.code).toBe("unknown");
      expect(err.retryable).toBe(false);
      expect(err.message).toBe("boom");
      expect(err.cause).toBeInstanceOf(Error);
      expect(err.name).toBe("GenerationError");
    });
  });

  describe("max_tokens com tool_use parcial — defesa em profundidade", () => {
    it("prioriza max_tokens sobre tool_use quando ambos estão presentes", async () => {
      // Cenário improvável mas defensivo: stop_reason=max_tokens com algum
      // tool_use no content. Tratamos como max_tokens (não-retryable) porque
      // o output pode estar truncado.
      anthropicMock.create.mockResolvedValue({
        stop_reason: "max_tokens",
        content: [
          { type: "tool_use", id: "x", name: "emit_site_copy", input: {} },
        ],
      });
      const { generateCopy } = await import("@/lib/sites/generate-copy");
      const err = await generateCopy(makeValidInput()).catch((e) => e);
      expect(err.code).toBe("max_tokens");
    });
  });

  describe("fallback 'unknown' — quando parse lança não-ZodError", () => {
    it("lança GenerationError code='unknown' com cause original (Error)", async () => {
      // IMPORTANTE: `vi.resetModules()` no `beforeEach` invalida o cache,
      // então precisamos importar `SiteCopySchema` *dentro* do teste pra
      // ter a MESMA instância usada por `generate-copy.ts`.
      const { SiteCopySchema: schema } = await import("@/types/lead-site");
      const customError = new Error("synthetic non-zod failure");
      const parseSpy = vi.spyOn(schema, "parse").mockImplementation(() => {
        throw customError;
      });

      anthropicMock.create.mockResolvedValue(
        toolUseResponse(makeValidSiteCopy()),
      );

      const { generateCopy } = await import("@/lib/sites/generate-copy");
      const { GenerationError } = await import("@/lib/sites/errors");

      const err = await generateCopy(makeValidInput()).catch((e) => e);
      expect(err).toBeInstanceOf(GenerationError);
      expect(err.code).toBe("unknown");
      expect(err.retryable).toBe(false);
      expect(err.cause).toBe(customError);
      expect(err.message).toContain("synthetic non-zod failure");

      parseSpy.mockRestore();
    });

    it("lança GenerationError code='unknown' quando parse joga string (não-Error)", async () => {
      // Cobre o ramo `String(cause)` do template literal.
      const { SiteCopySchema: schema } = await import("@/types/lead-site");
      const parseSpy = vi.spyOn(schema, "parse").mockImplementation(() => {
        // Lançar string aciona o ramo non-Error do ternary
        throw "string-thrown" as unknown;
      });

      anthropicMock.create.mockResolvedValue(
        toolUseResponse(makeValidSiteCopy()),
      );

      const { generateCopy } = await import("@/lib/sites/generate-copy");
      const err = await generateCopy(makeValidInput()).catch((e) => e);
      expect(err.code).toBe("unknown");
      expect(err.message).toContain("string-thrown");

      parseSpy.mockRestore();
    });
  });

  describe("api_error — branch cobertura do template literal", () => {
    it("exibe String(cause) quando o erro lançado pelo SDK não é Error", async () => {
      // Cobre o ramo `String(cause)` do template literal em api_error.
      anthropicMock.create.mockRejectedValue("non-error-rejection");

      const { generateCopy } = await import("@/lib/sites/generate-copy");
      const err = await generateCopy(makeValidInput()).catch((e) => e);
      expect(err.code).toBe("api_error");
      expect(err.message).toContain("non-error-rejection");
    });
  });
});
