import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  anthropicMock,
  anthropicState,
  resetAnthropicMock,
} from "@/tests/__mocks__/anthropic";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
  leadMaybeSingle: vi.fn(),
}));

const memoryMocks = vi.hoisted(() => ({
  getOrCreateConversation: vi.fn(),
  loadHistory: vi.fn(),
  appendMessage: vi.fn(),
}));

const toolMocks = vi.hoisted(() => ({
  handler: vi.fn(),
  isIaraToolName: vi.fn((name: string) =>
    [
      "consultar_estado_lead",
      "gerar_link_checkout",
      "escalar_para_humano",
      "agendar_followup",
      "marcar_lead_morto",
      "marcar_demanda_nao_atendida",
    ].includes(name),
  ),
}));

vi.mock("@anthropic-ai/sdk", () => anthropicMock());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/ai/iara/memory", () => ({
  getOrCreateConversation: memoryMocks.getOrCreateConversation,
  loadHistory: memoryMocks.loadHistory,
  appendMessage: memoryMocks.appendMessage,
}));

vi.mock("@/lib/ai/iara/tools", () => {
  const handlers = new Proxy(
    {},
    {
      get: () => toolMocks.handler,
    },
  );
  return {
    IARA_TOOL_HANDLERS: handlers,
    isIaraToolName: toolMocks.isIaraToolName,
  };
});

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/iara/sandbox/conversation", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_LEAD_ID = "11111111-1111-1111-8111-111111111111";

beforeEach(() => {
  vi.resetModules();
  resetAnthropicMock();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  supabaseMocks.leadMaybeSingle.mockReset();
  memoryMocks.getOrCreateConversation.mockReset();
  memoryMocks.loadHistory.mockReset();
  memoryMocks.appendMessage.mockReset();
  toolMocks.handler.mockReset();

  supabaseMocks.createServerSupabase.mockResolvedValue({
    auth: { getUser: supabaseMocks.getUser },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: supabaseMocks.leadMaybeSingle,
          })),
        })),
      })),
    })),
  });
});

describe("POST /api/iara/sandbox/conversation", () => {
  it("retorna 401 sem usuário autenticado", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { POST } = await import(
      "@/app/api/iara/sandbox/conversation/route"
    );
    const res = await POST(makeReq({ leadId: VALID_LEAD_ID, userMessage: "oi" }));
    expect(res.status).toBe(401);
  });

  it("retorna 400 quando body é JSON inválido", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { POST } = await import(
      "@/app/api/iara/sandbox/conversation/route"
    );
    const res = await POST(makeReq("not-json{"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Body inválido");
  });

  it("retorna 400 quando leadId não é UUID", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { POST } = await import(
      "@/app/api/iara/sandbox/conversation/route"
    );
    const res = await POST(makeReq({ leadId: "not-uuid", userMessage: "oi" }));
    expect(res.status).toBe(400);
  });

  it("retorna 404 quando lead não pertence ao usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    supabaseMocks.leadMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    const { POST } = await import(
      "@/app/api/iara/sandbox/conversation/route"
    );
    const res = await POST(makeReq({ leadId: VALID_LEAD_ID, userMessage: "oi" }));
    expect(res.status).toBe(404);
  });

  it("happy path SEM tool_use: persiste user+assistant e responde texto puro", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    supabaseMocks.leadMaybeSingle.mockResolvedValue({
      data: { id: VALID_LEAD_ID },
      error: null,
    });
    memoryMocks.getOrCreateConversation.mockResolvedValue({
      id: "conv-1",
      iaraVersion: "1.1",
    });
    memoryMocks.loadHistory.mockResolvedValue([]);
    memoryMocks.appendMessage.mockResolvedValue(undefined);

    anthropicState.create.mockResolvedValueOnce({
      id: "msg_1",
      content: [{ type: "text", text: "Oi! Aqui é a Iara." }],
      stop_reason: "end_turn",
      role: "assistant",
      model: "claude-sonnet-4-6",
      usage: { input_tokens: 10, output_tokens: 20 },
    });

    const { POST } = await import(
      "@/app/api/iara/sandbox/conversation/route"
    );
    const res = await POST(
      makeReq({ leadId: VALID_LEAD_ID, userMessage: "oi" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.conversationId).toBe("conv-1");
    expect(json.assistantMessage).toBe("Oi! Aqui é a Iara.");
    expect(json.toolCalls).toEqual([]);
    expect(json.handoff).toBeNull();

    // Persistiu o turn do user antes de chamar IA + o turn final do assistant.
    expect(memoryMocks.appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: "user", content: "oi" }),
    );
    expect(memoryMocks.appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "assistant",
        content: "Oi! Aqui é a Iara.",
      }),
    );
    expect(toolMocks.handler).not.toHaveBeenCalled();
  });

  it("tool_use → tool_result → texto final: registra handoff e tool_calls", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    supabaseMocks.leadMaybeSingle.mockResolvedValue({
      data: { id: VALID_LEAD_ID },
      error: null,
    });
    memoryMocks.getOrCreateConversation.mockResolvedValue({
      id: "conv-1",
      iaraVersion: "1.1",
    });
    memoryMocks.loadHistory.mockResolvedValue([]);
    memoryMocks.appendMessage.mockResolvedValue(undefined);

    // 1ª resposta: assistant chama escalar_para_humano (P0).
    anthropicState.create.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "escalar_para_humano",
          input: {
            lead_id: VALID_LEAD_ID,
            priority: "P0",
            motivo: "cliente disse vou pagar agora",
          },
        },
      ],
      stop_reason: "tool_use",
    });

    // Handler retorna ok.
    toolMocks.handler.mockResolvedValueOnce({
      ok: true,
      handoff_id: "ho-1",
      priority: "P0",
    });

    // 2ª resposta: assistant emite texto final.
    anthropicState.create.mockResolvedValueOnce({
      content: [{ type: "text", text: "Show, já avisei o Vinicius!" }],
      stop_reason: "end_turn",
    });

    const { POST } = await import(
      "@/app/api/iara/sandbox/conversation/route"
    );
    const res = await POST(
      makeReq({ leadId: VALID_LEAD_ID, userMessage: "vou pagar agora" }),
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.assistantMessage).toBe("Show, já avisei o Vinicius!");
    expect(json.toolCalls).toHaveLength(1);
    expect(json.toolCalls[0].tool).toBe("escalar_para_humano");
    expect(json.handoff).toEqual({
      priority: "P0",
      motivo: "cliente disse vou pagar agora",
    });

    // Chamou Anthropic 2x (loop terminou no texto).
    expect(anthropicState.create).toHaveBeenCalledTimes(2);
    // Handler do tool foi invocado 1x.
    expect(toolMocks.handler).toHaveBeenCalledTimes(1);
  });

  it("aborta tool loop após MAX_TOOL_ITERATIONS sem texto", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    supabaseMocks.leadMaybeSingle.mockResolvedValue({
      data: { id: VALID_LEAD_ID },
      error: null,
    });
    memoryMocks.getOrCreateConversation.mockResolvedValue({
      id: "conv-1",
      iaraVersion: "1.1",
    });
    memoryMocks.loadHistory.mockResolvedValue([]);

    // Sempre devolve tool_use → simula "looping".
    anthropicState.create.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "toolu_x",
          name: "consultar_estado_lead",
          input: { lead_id: VALID_LEAD_ID },
        },
      ],
      stop_reason: "tool_use",
    });
    toolMocks.handler.mockResolvedValue({ ok: true });

    const { POST } = await import(
      "@/app/api/iara/sandbox/conversation/route"
    );
    const res = await POST(
      makeReq({ leadId: VALID_LEAD_ID, userMessage: "..." }),
    );
    expect(res.status).toBe(200);
    expect(anthropicState.create).toHaveBeenCalledTimes(3); // teto = 3
  });
});
