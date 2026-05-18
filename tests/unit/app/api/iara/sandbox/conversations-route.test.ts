import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const serviceMocks = vi.hoisted(() => ({
  conversationsResult: vi.fn(),
  messagesResult: vi.fn(),
  handoffsResult: vi.fn(),
  createServiceSupabase: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabase: serviceMocks.createServiceSupabase,
}));

function buildServiceClient() {
  // Conversations chain: from('whatsapp_conversations').select(...).eq(...).order(...).limit(...) [.eq/.lt]+
  function chainable(finalResult: () => Promise<unknown>) {
    const builder: Record<string, unknown> = {};
    builder.eq = vi.fn(() => builder);
    builder.lt = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(finalResult);
    builder.then = (
      onFulfilled: (v: unknown) => unknown,
      onRejected: (e: unknown) => unknown,
    ) => finalResult().then(onFulfilled, onRejected);
    return builder;
  }

  return {
    from: vi.fn((table: string) => {
      if (table === "whatsapp_conversations") {
        return {
          select: vi.fn(() => chainable(() => serviceMocks.conversationsResult())),
        };
      }
      if (table === "iara_messages") {
        return {
          select: vi.fn(() => chainable(() => serviceMocks.messagesResult())),
        };
      }
      if (table === "iara_handoffs") {
        return {
          select: vi.fn(() => chainable(() => serviceMocks.handoffsResult())),
        };
      }
      return {
        select: vi.fn(() =>
          chainable(() => Promise.resolve({ data: [], error: null })),
        ),
      };
    }),
  };
}

function makeReq(qs = ""): Request {
  return new Request(`http://localhost/api/iara/sandbox/conversations${qs}`, {
    method: "GET",
  });
}

beforeEach(() => {
  vi.resetModules();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  serviceMocks.conversationsResult.mockReset();
  serviceMocks.messagesResult.mockReset();
  serviceMocks.handoffsResult.mockReset();
  serviceMocks.createServiceSupabase.mockReset();

  supabaseMocks.createServerSupabase.mockResolvedValue({
    auth: { getUser: supabaseMocks.getUser },
  });
  serviceMocks.createServiceSupabase.mockImplementation(() =>
    buildServiceClient(),
  );
});

describe("GET /api/iara/sandbox/conversations", () => {
  it("retorna 401 sem usuário autenticado", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { GET } = await import(
      "@/app/api/iara/sandbox/conversations/route"
    );
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("retorna 400 quando limit fora do range", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { GET } = await import(
      "@/app/api/iara/sandbox/conversations/route"
    );
    const res = await GET(makeReq("?limit=500"));
    expect(res.status).toBe(400);
  });

  it("retorna lista vazia com nextCursor null quando não há conversas", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    serviceMocks.conversationsResult.mockResolvedValue({
      data: [],
      error: null,
    });
    const { GET } = await import(
      "@/app/api/iara/sandbox/conversations/route"
    );
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toEqual([]);
    expect(json.nextCursor).toBeNull();
  });

  it("mapeia conversas com counts de mensagens/handoffs e latestHandoffPriority", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    serviceMocks.conversationsResult.mockResolvedValue({
      data: [
        {
          id: "conv-1",
          lead_id: "lead-1",
          iara_version: "1.1",
          is_sandbox: true,
          last_message_at: "2026-05-18T12:00:00.000Z",
          approval_status: "pending",
          created_at: "2026-05-18T10:00:00.000Z",
          leads: { name: "AutoStar", city: "São Paulo" },
        },
      ],
      error: null,
    });
    serviceMocks.messagesResult.mockResolvedValue({
      data: [
        { conversation_id: "conv-1" },
        { conversation_id: "conv-1" },
        { conversation_id: "conv-1" },
      ],
      error: null,
    });
    serviceMocks.handoffsResult.mockResolvedValue({
      data: [
        {
          conversation_id: "conv-1",
          priority: "P0",
          created_at: "2026-05-18T11:30:00.000Z",
        },
        {
          conversation_id: "conv-1",
          priority: "P2",
          created_at: "2026-05-18T11:00:00.000Z",
        },
      ],
      error: null,
    });
    const { GET } = await import(
      "@/app/api/iara/sandbox/conversations/route"
    );
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0]).toEqual(
      expect.objectContaining({
        id: "conv-1",
        leadId: "lead-1",
        leadBusinessName: "AutoStar",
        leadCity: "São Paulo",
        messageCount: 3,
        handoffCount: 2,
        latestHandoffPriority: "P0",
        approvalStatus: "pending",
      }),
    );
  });

  it("filtra por handoffPriority em memória (P0 only)", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    serviceMocks.conversationsResult.mockResolvedValue({
      data: [
        {
          id: "conv-1",
          lead_id: "lead-1",
          iara_version: "1.1",
          is_sandbox: true,
          last_message_at: "2026-05-18T12:00:00.000Z",
          approval_status: "pending",
          created_at: "2026-05-18T10:00:00.000Z",
          leads: { name: "AutoStar", city: "São Paulo" },
        },
        {
          id: "conv-2",
          lead_id: "lead-2",
          iara_version: "1.1",
          is_sandbox: true,
          last_message_at: "2026-05-18T11:00:00.000Z",
          approval_status: "pending",
          created_at: "2026-05-18T10:00:00.000Z",
          leads: { name: "BeagleCars", city: "Curitiba" },
        },
      ],
      error: null,
    });
    serviceMocks.messagesResult.mockResolvedValue({
      data: [],
      error: null,
    });
    serviceMocks.handoffsResult.mockResolvedValue({
      data: [
        {
          conversation_id: "conv-1",
          priority: "P0",
          created_at: "2026-05-18T11:30:00.000Z",
        },
        {
          conversation_id: "conv-2",
          priority: "P2",
          created_at: "2026-05-18T10:30:00.000Z",
        },
      ],
      error: null,
    });
    const { GET } = await import(
      "@/app/api/iara/sandbox/conversations/route"
    );
    const res = await GET(makeReq("?handoffPriority=P0"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].id).toBe("conv-1");
  });

  it("retorna 502 friendly quando query supabase falha", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    serviceMocks.conversationsResult.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const { GET } = await import(
      "@/app/api/iara/sandbox/conversations/route"
    );
    const res = await GET(makeReq());
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toMatch(/Falha ao listar conversas/);
  });
});
