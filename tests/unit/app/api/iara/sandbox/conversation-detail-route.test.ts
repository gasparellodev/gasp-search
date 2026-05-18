import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const serviceMocks = vi.hoisted(() => ({
  ownershipResult: vi.fn(),
  leadResult: vi.fn(),
  messagesResult: vi.fn(),
  handoffsResult: vi.fn(),
  deleteResult: vi.fn(),
  createServiceSupabase: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabase: serviceMocks.createServiceSupabase,
}));

function buildServiceClient() {
  function chain(finalResult: () => Promise<unknown>) {
    const builder: Record<string, unknown> = {};
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
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
          select: vi.fn(() => chain(() => serviceMocks.ownershipResult())),
          delete: vi.fn(() => chain(() => serviceMocks.deleteResult())),
        };
      }
      if (table === "leads") {
        return {
          select: vi.fn(() => chain(() => serviceMocks.leadResult())),
        };
      }
      if (table === "iara_messages") {
        return {
          select: vi.fn(() => chain(() => serviceMocks.messagesResult())),
        };
      }
      if (table === "iara_handoffs") {
        return {
          select: vi.fn(() => chain(() => serviceMocks.handoffsResult())),
        };
      }
      return {
        select: vi.fn(() =>
          chain(() => Promise.resolve({ data: [], error: null })),
        ),
      };
    }),
  };
}

beforeEach(() => {
  vi.resetModules();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  serviceMocks.ownershipResult.mockReset();
  serviceMocks.leadResult.mockReset();
  serviceMocks.messagesResult.mockReset();
  serviceMocks.handoffsResult.mockReset();
  serviceMocks.deleteResult.mockReset();
  serviceMocks.createServiceSupabase.mockReset();

  supabaseMocks.createServerSupabase.mockResolvedValue({
    auth: { getUser: supabaseMocks.getUser },
  });
  serviceMocks.createServiceSupabase.mockImplementation(() =>
    buildServiceClient(),
  );
});

const PARAMS = (id = "conv-1") => ({ params: Promise.resolve({ id }) });

function makeReq(method = "GET"): Request {
  return new Request("http://localhost/api/iara/sandbox/conversation/conv-1", {
    method,
  });
}

describe("GET /api/iara/sandbox/conversation/[id]", () => {
  it("retorna 401 sem usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { GET } = await import(
      "@/app/api/iara/sandbox/conversation/[id]/route"
    );
    const res = await GET(makeReq(), PARAMS());
    expect(res.status).toBe(401);
  });

  it("retorna 404 quando conversa não é do user", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    serviceMocks.ownershipResult.mockResolvedValue({
      data: null,
      error: null,
    });
    const { GET } = await import(
      "@/app/api/iara/sandbox/conversation/[id]/route"
    );
    const res = await GET(makeReq(), PARAMS());
    expect(res.status).toBe(404);
  });

  it("retorna detalhe completo (conversation + lead + messages + handoffs)", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    serviceMocks.ownershipResult.mockResolvedValue({
      data: {
        id: "conv-1",
        lead_id: "lead-1",
        user_id: "user-1",
        iara_version: "1.1",
        is_sandbox: true,
        last_message_at: "2026-05-18T12:00:00.000Z",
        approval_status: "pending",
        approval_notes: null,
        reviewed_at: null,
        created_at: "2026-05-18T10:00:00.000Z",
      },
      error: null,
    });
    serviceMocks.leadResult.mockResolvedValue({
      data: {
        id: "lead-1",
        name: "AutoStar",
        city: "São Paulo",
        stage: "new",
      },
      error: null,
    });
    serviceMocks.messagesResult.mockResolvedValue({
      data: [
        {
          role: "user",
          content: "oi",
          tool_calls: null,
          created_at: "2026-05-18T10:00:00.000Z",
        },
        {
          role: "assistant",
          content: "Oi, aqui é a Iara",
          tool_calls: null,
          created_at: "2026-05-18T10:00:05.000Z",
        },
      ],
      error: null,
    });
    serviceMocks.handoffsResult.mockResolvedValue({
      data: [
        {
          priority: "P1",
          motivo: "pediu desconto",
          created_at: "2026-05-18T11:00:00.000Z",
          resolved_at: null,
        },
      ],
      error: null,
    });
    const { GET } = await import(
      "@/app/api/iara/sandbox/conversation/[id]/route"
    );
    const res = await GET(makeReq(), PARAMS());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.conversation.id).toBe("conv-1");
    expect(json.lead.business_name).toBe("AutoStar");
    expect(json.messages).toHaveLength(2);
    expect(json.handoffs).toHaveLength(1);
    expect(json.handoffs[0].priority).toBe("P1");
  });
});

describe("DELETE /api/iara/sandbox/conversation/[id]", () => {
  it("retorna 401 sem usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { DELETE } = await import(
      "@/app/api/iara/sandbox/conversation/[id]/route"
    );
    const res = await DELETE(makeReq("DELETE"), PARAMS());
    expect(res.status).toBe(401);
  });

  it("retorna 404 quando conversa não é do user", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    serviceMocks.ownershipResult.mockResolvedValue({
      data: null,
      error: null,
    });
    const { DELETE } = await import(
      "@/app/api/iara/sandbox/conversation/[id]/route"
    );
    const res = await DELETE(makeReq("DELETE"), PARAMS());
    expect(res.status).toBe(404);
  });

  it("retorna {ok:true} quando delete sucede", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    serviceMocks.ownershipResult.mockResolvedValue({
      data: {
        id: "conv-1",
        lead_id: "lead-1",
        user_id: "user-1",
        iara_version: "1.1",
        is_sandbox: true,
        last_message_at: null,
        approval_status: "pending",
        approval_notes: null,
        reviewed_at: null,
        created_at: "2026-05-18T10:00:00.000Z",
      },
      error: null,
    });
    serviceMocks.deleteResult.mockResolvedValue({
      data: null,
      error: null,
    });
    const { DELETE } = await import(
      "@/app/api/iara/sandbox/conversation/[id]/route"
    );
    const res = await DELETE(makeReq("DELETE"), PARAMS());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });
});
