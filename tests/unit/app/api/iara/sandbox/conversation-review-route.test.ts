import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const serviceMocks = vi.hoisted(() => ({
  ownershipResult: vi.fn(),
  updateResult: vi.fn(),
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
          update: vi.fn(() => chain(() => serviceMocks.updateResult())),
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

const PARAMS = (id = "conv-1") => ({ params: Promise.resolve({ id }) });

function makeReq(body: unknown): Request {
  return new Request(
    "http://localhost/api/iara/sandbox/conversation/conv-1/review",
    {
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
}

beforeEach(() => {
  vi.resetModules();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  serviceMocks.ownershipResult.mockReset();
  serviceMocks.updateResult.mockReset();
  serviceMocks.createServiceSupabase.mockReset();

  supabaseMocks.createServerSupabase.mockResolvedValue({
    auth: { getUser: supabaseMocks.getUser },
  });
  serviceMocks.createServiceSupabase.mockImplementation(() =>
    buildServiceClient(),
  );
});

describe("PATCH /api/iara/sandbox/conversation/[id]/review", () => {
  it("retorna 401 sem usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { PATCH } = await import(
      "@/app/api/iara/sandbox/conversation/[id]/review/route"
    );
    const res = await PATCH(makeReq({ approvalStatus: "approved" }), PARAMS());
    expect(res.status).toBe(401);
  });

  it("retorna 400 com JSON inválido", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { PATCH } = await import(
      "@/app/api/iara/sandbox/conversation/[id]/review/route"
    );
    const res = await PATCH(makeReq("not-json{"), PARAMS());
    expect(res.status).toBe(400);
  });

  it("retorna 400 com approvalStatus inválido", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { PATCH } = await import(
      "@/app/api/iara/sandbox/conversation/[id]/review/route"
    );
    const res = await PATCH(
      makeReq({ approvalStatus: "foo" }),
      PARAMS(),
    );
    expect(res.status).toBe(400);
  });

  it("retorna 404 quando conversa não pertence ao user", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    serviceMocks.ownershipResult.mockResolvedValue({
      data: null,
      error: null,
    });
    const { PATCH } = await import(
      "@/app/api/iara/sandbox/conversation/[id]/review/route"
    );
    const res = await PATCH(
      makeReq({ approvalStatus: "approved" }),
      PARAMS(),
    );
    expect(res.status).toBe(404);
  });

  it("aprova com sucesso e retorna reviewedAt", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    serviceMocks.ownershipResult.mockResolvedValue({
      data: { id: "conv-1", user_id: "user-1" },
      error: null,
    });
    serviceMocks.updateResult.mockResolvedValue({ data: null, error: null });
    const { PATCH } = await import(
      "@/app/api/iara/sandbox/conversation/[id]/review/route"
    );
    const res = await PATCH(
      makeReq({ approvalStatus: "approved", approvalNotes: "tom natural" }),
      PARAMS(),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.approvalStatus).toBe("approved");
    expect(typeof json.reviewedAt).toBe("string");
  });

  it("voltar para pending zera reviewedAt", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    serviceMocks.ownershipResult.mockResolvedValue({
      data: { id: "conv-1", user_id: "user-1" },
      error: null,
    });
    serviceMocks.updateResult.mockResolvedValue({ data: null, error: null });
    const { PATCH } = await import(
      "@/app/api/iara/sandbox/conversation/[id]/review/route"
    );
    const res = await PATCH(makeReq({ approvalStatus: "pending" }), PARAMS());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reviewedAt).toBeNull();
  });
});
