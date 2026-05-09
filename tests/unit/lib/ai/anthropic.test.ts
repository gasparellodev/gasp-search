import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Tables } from "@/types/database";

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

const anthropicMock = vi.hoisted(() => ({
  create: vi.fn(),
  constructorOptions: [] as unknown[],
}));

vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    messages = {
      create: anthropicMock.create,
    };

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

function makeLead(
  overrides: Partial<Tables<"leads">> = {},
): Tables<"leads"> {
  return {
    id: "lead-1",
    user_id: "user-1",
    source: "google_maps",
    source_search_job_id: "job-1",
    name: "Barbearia Bigode",
    category: "Barbearia",
    city: "São Paulo",
    state: "SP",
    country: "Brasil",
    phone: "+55 11 99999-0000",
    email: "contato@bigode.com.br",
    website: "bigode.com.br",
    instagram_handle: "barbeariabigode",
    whatsapp: null,
    has_website: true,
    rating: 4.7,
    reviews_count: 128,
    followers_count: 2400,
    stage: "new",
    score: 73,
    notes: "Lead quer melhorar agendamento online.",
    raw: { otherLeadName: "Clínica Vazou" },
    enriched_at: null,
    created_at: "2026-05-07T00:00:00Z",
    updated_at: "2026-05-07T00:00:00Z",
    ...overrides,
  };
}

describe("generateMessage", () => {
  it("envia o modelo configurado, dados do lead e retorna o texto gerado", async () => {
    anthropicMock.create.mockResolvedValue({
      content: [{ type: "text", text: "Olá, vi que a Barbearia Bigode..." }],
    });

    const { generateMessage } = await import("@/lib/ai/anthropic");

    const text = await generateMessage(makeLead(), {
      channel: "whatsapp",
      tone: "consultivo",
      goal: "agendar uma conversa sobre novo site",
    });

    expect(text).toBe("Olá, vi que a Barbearia Bigode...");
    expect(anthropicMock.constructorOptions).toEqual([
      { apiKey: "sk-ant-test" },
    ]);
    expect(anthropicMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-6",
        max_tokens: expect.any(Number),
      }),
    );

    const [request] = anthropicMock.create.mock.calls[0] as [unknown];
    const serialized = JSON.stringify(request);
    expect(serialized).toContain("Barbearia Bigode");
    expect(serialized).toContain("bigode.com.br");
    expect(serialized).toContain("barbeariabigode");
    expect(serialized).toContain("whatsapp");
    expect(serialized).toContain("consultivo");
    expect(serialized).toContain("agendar uma conversa");
  });

  it("não vaza raw payload nem dados que não pertencem ao prompt whitelisted", async () => {
    anthropicMock.create.mockResolvedValue({
      content: [{ type: "text", text: "Mensagem segura" }],
    });

    const { generateMessage } = await import("@/lib/ai/anthropic");

    await generateMessage(makeLead(), {
      channel: "email",
      tone: "direto",
      goal: "validar interesse",
    });

    const [request] = anthropicMock.create.mock.calls[0] as [unknown];
    expect(JSON.stringify(request)).not.toContain("Clínica Vazou");
  });

  it("cacheia o system prompt com cache_control ephemeral", async () => {
    anthropicMock.create.mockResolvedValue({
      content: [{ type: "text", text: "Mensagem" }],
    });

    const { generateMessage } = await import("@/lib/ai/anthropic");

    await generateMessage(makeLead(), {
      channel: "instagram",
      tone: "amigável",
      goal: "iniciar conversa",
    });

    const [request] = anthropicMock.create.mock.calls[0] as [
      { system?: unknown },
    ];

    expect(request.system).toEqual([
      expect.objectContaining({
        type: "text",
        cache_control: { type: "ephemeral" },
      }),
    ]);
  });

  it("reutiliza o client Anthropic na mesma instância de módulo", async () => {
    anthropicMock.create.mockResolvedValue({
      content: [{ type: "text", text: "Mensagem" }],
    });

    const { generateMessage } = await import("@/lib/ai/anthropic");

    await generateMessage(makeLead({ id: "lead-1" }), {
      channel: "whatsapp",
      tone: "consultivo",
      goal: "primeiro contato",
    });
    await generateMessage(makeLead({ id: "lead-2", name: "Padaria Aurora" }), {
      channel: "whatsapp",
      tone: "consultivo",
      goal: "primeiro contato",
    });

    expect(anthropicMock.constructorOptions).toHaveLength(1);
    expect(anthropicMock.create).toHaveBeenCalledTimes(2);
  });

  it("lança erro tipado quando Anthropic não retorna texto", async () => {
    anthropicMock.create.mockResolvedValue({
      content: [{ type: "tool_use", id: "tool-1", name: "x", input: {} }],
    });

    const { AnthropicMessageError, generateMessage } = await import(
      "@/lib/ai/anthropic"
    );

    await expect(
      generateMessage(makeLead(), {
        channel: "email",
        tone: "direto",
        goal: "validar interesse",
      }),
    ).rejects.toBeInstanceOf(AnthropicMessageError);
  });
});

describe("anthropic (shared client — issue #158)", () => {
  it("constrói o client com a apiKey do env quando uma chamada é feita", async () => {
    anthropicMock.create.mockResolvedValue({ content: [], stop_reason: null });

    const { anthropic } = await import("@/lib/ai/anthropic");
    // Forçar resolução do Proxy invocando uma propriedade do SDK
    await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1,
      messages: [],
    });

    expect(anthropicMock.constructorOptions).toEqual([
      { apiKey: "sk-ant-test" },
    ]);
    expect(anthropicMock.create).toHaveBeenCalledTimes(1);
  });

  it("compartilha a mesma instância entre getAnthropic() e o named export anthropic", async () => {
    anthropicMock.create.mockResolvedValue({ content: [], stop_reason: null });

    const { anthropic, getAnthropic } = await import("@/lib/ai/anthropic");

    // Trigger lazy init via Proxy
    await anthropic.messages.create({
      model: "x",
      max_tokens: 1,
      messages: [],
    });
    // Subsequent direct call should reuse the same singleton
    getAnthropic();
    getAnthropic();

    // Construtor invocado UMA única vez = compartilhamento OK
    expect(anthropicMock.constructorOptions).toHaveLength(1);
  });

  it("anthropic é tipo Anthropic (SDK) — compatível com .messages.create", async () => {
    anthropicMock.create.mockResolvedValue({ content: [], stop_reason: null });
    const { anthropic } = await import("@/lib/ai/anthropic");

    expect(typeof anthropic.messages?.create).toBe("function");
  });
});
