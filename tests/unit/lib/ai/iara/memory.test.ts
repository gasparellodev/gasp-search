import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabaseClient } from "@/tests/__mocks__/supabase";

const supabaseHolder = vi.hoisted(() => ({
  client: null as ReturnType<typeof createMockSupabaseClient> | null,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabase: () => supabaseHolder.client,
}));

beforeEach(() => {
  supabaseHolder.client = createMockSupabaseClient();
  vi.resetModules();
});

describe("getOrCreateConversation", () => {
  it("reusa conversa existente (mesma lead_id + user_id)", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        whatsapp_conversations: {
          maybeSingle: {
            data: { id: "conv-1", iara_version: "1.1" },
            error: null,
          },
        },
      },
    });

    const { getOrCreateConversation } = await import("@/lib/ai/iara/memory");
    const result = await getOrCreateConversation({
      leadId: "lead-1",
      userId: "user-1",
      isSandbox: true,
    });

    expect(result).toEqual({ id: "conv-1", iaraVersion: "1.1" });
    const builder = supabaseHolder.client!.builders.whatsapp_conversations!;
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it("cria nova conversa quando não existe", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        whatsapp_conversations: {
          maybeSingle: { data: null, error: null },
          selectSingle: {
            data: { id: "conv-new", iara_version: "1.1" },
            error: null,
          },
        },
      },
    });

    const { getOrCreateConversation } = await import("@/lib/ai/iara/memory");
    const result = await getOrCreateConversation({
      leadId: "lead-1",
      userId: "user-1",
      isSandbox: true,
    });

    expect(result).toEqual({ id: "conv-new", iaraVersion: "1.1" });
    const builder = supabaseHolder.client!.builders.whatsapp_conversations!;
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_id: "lead-1",
        user_id: "user-1",
        is_sandbox: true,
        iara_version: "1.1",
      }),
    );
  });

  it("lança quando select falha", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        whatsapp_conversations: {
          maybeSingle: { data: null, error: { message: "boom" } },
        },
      },
    });

    const { getOrCreateConversation } = await import("@/lib/ai/iara/memory");
    await expect(
      getOrCreateConversation({
        leadId: "lead-1",
        userId: "user-1",
        isSandbox: true,
      }),
    ).rejects.toThrow(/boom/);
  });

  it("lança quando insert falha", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        whatsapp_conversations: {
          maybeSingle: { data: null, error: null },
          selectSingle: { data: null, error: { message: "insert failed" } },
        },
      },
    });

    const { getOrCreateConversation } = await import("@/lib/ai/iara/memory");
    await expect(
      getOrCreateConversation({
        leadId: "lead-1",
        userId: "user-1",
        isSandbox: true,
      }),
    ).rejects.toThrow(/insert failed/);
  });
});

describe("appendMessage", () => {
  it("insere row e bumpa last_message_at", async () => {
    supabaseHolder.client = createMockSupabaseClient();
    const { appendMessage } = await import("@/lib/ai/iara/memory");

    await appendMessage({
      conversationId: "conv-1",
      role: "user",
      content: "olá",
    });

    const insertBuilder = supabaseHolder.client!.builders.iara_messages!;
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "conv-1",
        role: "user",
        content: "olá",
        tool_calls: null,
      }),
    );
    const updateBuilder =
      supabaseHolder.client!.builders.whatsapp_conversations!;
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_message_at: expect.any(String),
      }),
    );
  });

  it("persiste tool_calls quando fornecido", async () => {
    supabaseHolder.client = createMockSupabaseClient();
    const { appendMessage } = await import("@/lib/ai/iara/memory");

    const toolCalls = [{ tool: "consultar_estado_lead", input: {}, output: {} }];
    await appendMessage({
      conversationId: "conv-1",
      role: "assistant",
      content: "tudo certo",
      toolCalls,
    });

    const insertBuilder = supabaseHolder.client!.builders.iara_messages!;
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ tool_calls: toolCalls }),
    );
  });

  it("lança se insert falhar", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        iara_messages: { insert: { data: null, error: { message: "nope" } } },
      },
    });
    const { appendMessage } = await import("@/lib/ai/iara/memory");

    await expect(
      appendMessage({
        conversationId: "conv-1",
        role: "user",
        content: "x",
      }),
    ).rejects.toThrow(/nope/);
  });

  it("lança se bump de last_message_at falhar", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        whatsapp_conversations: {
          update: { data: null, error: { message: "update boom" } },
        },
      },
    });
    const { appendMessage } = await import("@/lib/ai/iara/memory");

    await expect(
      appendMessage({
        conversationId: "conv-1",
        role: "user",
        content: "x",
      }),
    ).rejects.toThrow(/update boom/);
  });
});

describe("loadHistory", () => {
  it("ordena ASC por created_at e mapeia tool_calls para array ou null", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        iara_messages: {
          selectList: {
            data: [
              { role: "user", content: "oi", tool_calls: null },
              {
                role: "assistant",
                content: "olá",
                tool_calls: [{ tool: "consultar_estado_lead" }],
              },
              { role: "user", content: "blz", tool_calls: "not-array" },
            ],
            error: null,
          },
        },
      },
    });

    const { loadHistory } = await import("@/lib/ai/iara/memory");
    const history = await loadHistory("conv-1");

    expect(history).toHaveLength(3);
    expect(history[0]?.role).toBe("user");
    expect(history[1]?.role).toBe("assistant");
    expect(history[1]?.toolCalls).toEqual([
      { tool: "consultar_estado_lead" },
    ]);
    // valor não-array vira null
    expect(history[2]?.toolCalls).toBeNull();

    const builder = supabaseHolder.client!.builders.iara_messages!;
    expect(builder.order).toHaveBeenCalledWith("created_at", {
      ascending: true,
    });
  });

  it("retorna [] quando data é null", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        iara_messages: {
          selectList: { data: null as unknown as unknown[], error: null },
        },
      },
    });
    const { loadHistory } = await import("@/lib/ai/iara/memory");
    const history = await loadHistory("conv-1");
    expect(history).toEqual([]);
  });

  it("normaliza role não-conhecida para 'user'", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        iara_messages: {
          selectList: {
            data: [{ role: "system", content: "x", tool_calls: null }],
            error: null,
          },
        },
      },
    });
    const { loadHistory } = await import("@/lib/ai/iara/memory");
    const history = await loadHistory("conv-1");
    expect(history[0]?.role).toBe("user");
  });

  it("lança quando o select falha", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        iara_messages: {
          selectList: {
            data: null as unknown as unknown[],
            error: { message: "select err" },
          },
        },
      },
    });
    const { loadHistory } = await import("@/lib/ai/iara/memory");
    await expect(loadHistory("conv-1")).rejects.toThrow(/select err/);
  });
});

describe("recordHandoff", () => {
  it("insere row com priority e motivo e retorna id", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        iara_handoffs: {
          selectSingle: { data: { id: "ho-1" }, error: null },
        },
      },
    });

    const { recordHandoff } = await import("@/lib/ai/iara/memory");
    const result = await recordHandoff({
      conversationId: "conv-1",
      priority: "P0",
      motivo: "fechou",
    });

    expect(result).toEqual({ id: "ho-1" });
    const builder = supabaseHolder.client!.builders.iara_handoffs!;
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "conv-1",
        priority: "P0",
        motivo: "fechou",
      }),
    );
  });

  it("lança quando insert falha", async () => {
    supabaseHolder.client = createMockSupabaseClient({
      tables: {
        iara_handoffs: {
          selectSingle: { data: null, error: { message: "handoff err" } },
        },
      },
    });
    const { recordHandoff } = await import("@/lib/ai/iara/memory");
    await expect(
      recordHandoff({
        conversationId: "conv-1",
        priority: "P0",
        motivo: "x",
      }),
    ).rejects.toThrow(/handoff err/);
  });
});
