import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const listLeadMessagesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/ai/messages", () => ({
  listLeadMessages: listLeadMessagesMock,
  LEAD_MESSAGES_PAGE_SIZE: 20,
}));

function makeReq(url: string) {
  return new Request(url, { method: "GET" });
}

beforeEach(() => {
  vi.resetModules();
  listLeadMessagesMock.mockReset();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  supabaseMocks.createServerSupabase.mockResolvedValue({
    auth: { getUser: supabaseMocks.getUser },
  });
});

describe("GET /api/messages", () => {
  it("retorna 401 sem usuário autenticado", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { GET } = await import("@/app/api/messages/route");
    const res = await GET(makeReq("http://localhost/api/messages?leadId=l1"));
    expect(res.status).toBe(401);
    expect(listLeadMessagesMock).not.toHaveBeenCalled();
  });

  it("retorna 400 quando leadId está ausente", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { GET } = await import("@/app/api/messages/route");
    const res = await GET(makeReq("http://localhost/api/messages"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: expect.stringMatching(/leadId/i),
    });
    expect(listLeadMessagesMock).not.toHaveBeenCalled();
  });

  it("happy path: chama listLeadMessages com realOnly:true e retorna mensagens + paginação", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    listLeadMessagesMock.mockResolvedValue({
      messages: [
        {
          id: "m1",
          lead_id: "lead-1",
          channel: "whatsapp",
          tone: null,
          content: "olá",
          created_at: "2026-05-08T12:00:00Z",
          direction: "inbound",
          status: "delivered",
          whatsapp_msg_id: "evo-1",
          campaign_id: null,
          ai_generated: false,
          error_message: null,
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    const { GET } = await import("@/app/api/messages/route");
    const res = await GET(
      makeReq("http://localhost/api/messages?leadId=lead-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toHaveLength(1);
    expect(body.totalCount).toBe(1);
    expect(body.pageSize).toBe(20);

    expect(listLeadMessagesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "lead-1",
        page: 1,
        realOnly: true,
      }),
    );
  });

  it("propaga erro do listLeadMessages como 502", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    listLeadMessagesMock.mockRejectedValue(new Error("rls"));

    const { GET } = await import("@/app/api/messages/route");
    const res = await GET(
      makeReq("http://localhost/api/messages?leadId=lead-1"),
    );
    expect(res.status).toBe(502);
  });

  it("normaliza page inválida (NaN) para 1", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    listLeadMessagesMock.mockResolvedValue({
      messages: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });

    const { GET } = await import("@/app/api/messages/route");
    await GET(
      makeReq("http://localhost/api/messages?leadId=lead-1&page=abc"),
    );
    expect(listLeadMessagesMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
    );
  });
});
