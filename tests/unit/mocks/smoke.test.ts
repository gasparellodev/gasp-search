/**
 * Smoke tests para os mock factories de #203 / Sprint 0 #F6.
 *
 * Valida a API ergonomic dos 3 helpers (`createMockSupabaseClient`,
 * `anthropicMock`, `apifyMock`) sem depender de código de produção —
 * apenas que o shape retornado bate com o consumido pelos callers reais.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  anthropicMock,
  anthropicState,
  mockAnthropicTextResponse,
  mockAnthropicToolUse,
  resetAnthropicMock,
} from "@/tests/__mocks__/anthropic";
import {
  apifyMock,
  apifyState,
  mockApifyActorRun,
  resetApifyMock,
} from "@/tests/__mocks__/apify";
import {
  createMockSupabaseClient,
} from "@/tests/__mocks__/supabase";

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

describe("createMockSupabaseClient", () => {
  it("retorna defaults vazios sem overrides", async () => {
    const client = createMockSupabaseClient();
    const result = await client.from("leads").select("*");
    expect(result).toEqual({ data: [], error: null });
  });

  it("aplica override `maybeSingle` por tabela", async () => {
    const client = createMockSupabaseClient({
      tables: {
        lead_sites: {
          maybeSingle: { data: { id: "abc" }, error: null },
        },
      },
    });
    const result = await client
      .from("lead_sites")
      .select("*")
      .eq("slug", "x")
      .maybeSingle();
    expect(result).toEqual({ data: { id: "abc" }, error: null });
  });

  it("aplica override `selectSingle` em `.insert().select().single()`", async () => {
    const client = createMockSupabaseClient({
      tables: {
        leads: {
          selectSingle: { data: { id: "lead-1" }, error: null },
        },
      },
    });
    const result = await client
      .from("leads")
      .insert({ name: "x" })
      .select()
      .single();
    expect(result).toEqual({ data: { id: "lead-1" }, error: null });
  });

  it("aplica override `update` quando builder é awaited diretamente", async () => {
    const client = createMockSupabaseClient({
      tables: {
        lead_sites: {
          update: { data: null, error: null },
        },
      },
    });
    const result = await client
      .from("lead_sites")
      .update({ status: "published" })
      .eq("id", "x");
    expect(result).toEqual({ data: null, error: null });
  });

  it("rastreia `fromCalls` e expõe `builders[table]`", async () => {
    const client = createMockSupabaseClient();
    await client.from("leads").select("*");
    await client.from("lead_sites").select("*");
    expect(client.fromCalls).toEqual(["leads", "lead_sites"]);
    expect(client.builders.leads).toBeDefined();
    expect(client.builders.leads?.select).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Anthropic mock
// ---------------------------------------------------------------------------

describe("anthropicMock", () => {
  beforeEach(() => {
    resetAnthropicMock();
  });

  it("instância expõe `messages.create` compartilhado com state", async () => {
    const { Anthropic } = anthropicMock();
    mockAnthropicToolUse({ slogan: "X" });
    const instance = new Anthropic({ apiKey: "test" }) as {
      messages: { create: (req: unknown) => Promise<unknown> };
    };
    const response = (await instance.messages.create({})) as {
      content: Array<{ type: string; input?: unknown }>;
    };
    expect(response.content[0]?.type).toBe("tool_use");
    expect(response.content[0]?.input).toEqual({ slogan: "X" });
  });

  it("registra `constructorOptions` ao instanciar", () => {
    const { Anthropic } = anthropicMock();
    new Anthropic({ apiKey: "k1" });
    new Anthropic({ apiKey: "k2" });
    expect(anthropicState.constructorOptions).toHaveLength(2);
  });

  it("`mockAnthropicTextResponse` retorna text content (sem tool_use)", async () => {
    const { Anthropic } = anthropicMock();
    mockAnthropicTextResponse("olá");
    const instance = new Anthropic({ apiKey: "test" }) as {
      messages: { create: (req: unknown) => Promise<unknown> };
    };
    const response = (await instance.messages.create({})) as {
      content: Array<{ type: string; text?: string }>;
      stop_reason: string;
    };
    expect(response.stop_reason).toBe("end_turn");
    expect(response.content[0]?.type).toBe("text");
    expect(response.content[0]?.text).toBe("olá");
  });

  it("`anthropicState.create.mockRejectedValueOnce` permite simular erro", async () => {
    const { Anthropic } = anthropicMock();
    anthropicState.create.mockRejectedValueOnce(new Error("rate limit"));
    const instance = new Anthropic({ apiKey: "test" }) as {
      messages: { create: (req: unknown) => Promise<unknown> };
    };
    await expect(instance.messages.create({})).rejects.toThrow("rate limit");
  });
});

// ---------------------------------------------------------------------------
// Apify mock
// ---------------------------------------------------------------------------

describe("apifyMock", () => {
  beforeEach(() => {
    resetApifyMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("`actor(id).call()` retorna `{defaultDatasetId}` por default", async () => {
    const { ApifyClient } = apifyMock();
    const client = new ApifyClient({ token: "t" }) as {
      actor: (id: string) => { call: (input: unknown) => Promise<unknown> };
    };
    const run = (await client.actor("acme").call({})) as {
      defaultDatasetId: string;
    };
    expect(run.defaultDatasetId).toBe("mock-dataset-id");
    expect(apifyState.lastActorId).toBe("acme");
  });

  it("`dataset(id).listItems()` retorna `{items: []}` por default", async () => {
    const { ApifyClient } = apifyMock();
    const client = new ApifyClient({ token: "t" }) as {
      dataset: (id: string) => { listItems: () => Promise<unknown> };
    };
    const result = (await client.dataset("ds-1").listItems()) as {
      items: unknown[];
    };
    expect(result.items).toEqual([]);
    expect(apifyState.lastDatasetId).toBe("ds-1");
  });

  it("`mockApifyActorRun(items)` configura call + listItems em um passo", async () => {
    mockApifyActorRun([{ name: "Acme" }, { name: "Beta" }]);
    const { ApifyClient } = apifyMock();
    const client = new ApifyClient({ token: "t" }) as {
      actor: (id: string) => { call: (input: unknown) => Promise<unknown> };
      dataset: (id: string) => { listItems: () => Promise<unknown> };
    };
    const run = (await client.actor("a").call({})) as {
      defaultDatasetId: string;
    };
    const items = (await client.dataset(run.defaultDatasetId).listItems()) as {
      items: unknown[];
    };
    expect(items.items).toHaveLength(2);
  });
});
