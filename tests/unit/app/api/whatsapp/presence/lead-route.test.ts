import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
  maybeSingle: vi.fn(),
}));

const presenceMocks = vi.hoisted(() => ({
  getLeadPresence: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/whatsapp/presence", () => ({
  getLeadPresence: presenceMocks.getLeadPresence,
}));

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
  presenceMocks.getLeadPresence.mockReset();
  supabaseMocks.createServerSupabase.mockResolvedValue(makeClient());
});

describe("GET /api/whatsapp/presence/[leadId]", () => {
  it("retorna 401 sem usuário autenticado", async () => {
    supabaseMocks.getUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await import(
      "@/app/api/whatsapp/presence/[leadId]/route"
    );

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ leadId: "lead-1" }),
    });

    expect(res.status).toBe(401);
    expect(presenceMocks.getLeadPresence).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o lead não pertence ao usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    supabaseMocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const { GET } = await import(
      "@/app/api/whatsapp/presence/[leadId]/route"
    );

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ leadId: "lead-1" }),
    });

    expect(res.status).toBe(404);
    expect(presenceMocks.getLeadPresence).not.toHaveBeenCalled();
  });

  it("retorna presença do Redis para lead do usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    supabaseMocks.maybeSingle.mockResolvedValue({
      data: { id: "lead-1" },
      error: null,
    });
    presenceMocks.getLeadPresence.mockResolvedValue({
      presence: "typing",
      lastSeen: "2026-05-12T12:00:00.000Z",
    });
    const { GET } = await import(
      "@/app/api/whatsapp/presence/[leadId]/route"
    );

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ leadId: "lead-1" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      presence: "typing",
      lastSeen: "2026-05-12T12:00:00.000Z",
    });
    expect(presenceMocks.getLeadPresence).toHaveBeenCalledWith({
      userId: "u1",
      leadId: "lead-1",
    });
  });
});
