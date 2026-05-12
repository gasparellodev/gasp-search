import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
  maybeSingle: vi.fn(),
}));

const presenceMocks = vi.hoisted(() => ({
  setLeadPresence: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/whatsapp/presence", () => ({
  setLeadPresence: presenceMocks.setLeadPresence,
}));

function makeReq(body: unknown) {
  return new Request("http://localhost/api/whatsapp/typing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function makeClient() {
  const eq = vi.fn(() => builder);
  const builder = {
    select: vi.fn(() => builder),
    eq,
    maybeSingle: supabaseMocks.maybeSingle,
  };
  return {
    from: vi.fn(() => builder),
    auth: { getUser: supabaseMocks.getUser },
  };
}

beforeEach(() => {
  vi.resetModules();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  supabaseMocks.maybeSingle.mockReset();
  presenceMocks.setLeadPresence.mockReset();
  supabaseMocks.createServerSupabase.mockResolvedValue(makeClient());
});

const validLeadId = "11111111-1111-4111-8111-111111111111";

describe("POST /api/whatsapp/typing", () => {
  it("retorna 401 sem usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await import("@/app/api/whatsapp/typing/route");
    const res = await POST(makeReq({ leadId: validLeadId, presence: "typing" }));
    expect(res.status).toBe(401);
  });

  it("retorna 400 em body inválido", async () => {
    supabaseMocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { POST } = await import("@/app/api/whatsapp/typing/route");
    const res = await POST(makeReq({ leadId: "x", presence: "recording" }));
    expect(res.status).toBe(400);
  });

  it("retorna 404 quando lead não pertence ao usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    supabaseMocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const { POST } = await import("@/app/api/whatsapp/typing/route");
    const res = await POST(
      makeReq({ leadId: validLeadId, presence: "typing" }),
    );
    expect(res.status).toBe(404);
    expect(presenceMocks.setLeadPresence).not.toHaveBeenCalled();
  });

  it("registra typing/paused para lead do usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    supabaseMocks.maybeSingle.mockResolvedValue({
      data: { id: validLeadId },
      error: null,
    });
    const { POST } = await import("@/app/api/whatsapp/typing/route");
    const res = await POST(
      makeReq({ leadId: validLeadId, presence: "paused" }),
    );

    expect(res.status).toBe(202);
    expect(presenceMocks.setLeadPresence).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        leadId: validLeadId,
        presence: "paused",
      }),
    );
  });
});
