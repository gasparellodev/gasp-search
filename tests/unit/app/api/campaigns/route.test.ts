import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const processMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/campaigns/processor", () => ({
  processCampaign: processMock,
}));

const VALID_LEAD = "11111111-1111-4111-8111-111111111111";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function makeSupabase(opts: {
  campaignsList?: { data: unknown; error: unknown };
  validLeads?: { data: unknown; error: unknown };
  insertResult?: { data: unknown; error: unknown };
  insertTargetsError?: unknown;
}) {
  const calls: Array<{ table: string; op: string }> = [];

  const from = vi.fn((table: string) => {
    if (table === "campaigns") {
      const insertSelectSingle = vi.fn(async () => ({
        data: opts.insertResult?.data ?? { id: "camp-1" },
        error: opts.insertResult?.error ?? null,
      }));
      const insertSelect = vi.fn(() => ({ single: insertSelectSingle }));
      const insert = vi.fn(() => {
        calls.push({ table, op: "insert" });
        return { select: insertSelect };
      });
      // GET list
      const limit = vi.fn(async () => opts.campaignsList ?? { data: [], error: null });
      const order = vi.fn(() => ({ limit }));
      const select = vi.fn(() => ({ order }));
      return { select, insert };
    }
    if (table === "leads") {
      const inSelect = vi.fn(async () => opts.validLeads ?? { data: [], error: null });
      const select = vi.fn(() => ({ in: inSelect }));
      return { select };
    }
    if (table === "campaign_targets") {
      const insert = vi.fn(async () => ({
        error: opts.insertTargetsError ?? null,
      }));
      return { insert };
    }
    throw new Error(`unexpected ${table}`);
  });

  return {
    client: { auth: { getUser: supabaseMocks.getUser }, from },
    spies: { from, calls },
  };
}

beforeEach(() => {
  vi.resetModules();
  supabaseMocks.getUser.mockReset();
  processMock.mockReset();
  processMock.mockResolvedValue({ sent: 0, failed: 0 });
});

describe("POST /api/campaigns", () => {
  it("retorna 401 sem usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    supabaseMocks.createServerSupabase.mockResolvedValue({
      auth: { getUser: supabaseMocks.getUser },
    });
    const { POST } = await import("@/app/api/campaigns/route");
    const res = await POST(makeReq({}));
    expect(res.status).toBe(401);
  });

  it("retorna 400 em body inválido", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    supabaseMocks.createServerSupabase.mockResolvedValue({
      auth: { getUser: supabaseMocks.getUser },
    });
    const { POST } = await import("@/app/api/campaigns/route");
    const res = await POST(makeReq({ name: "x" }));
    expect(res.status).toBe(400);
  });

  it("retorna 422 quando algum leadId não pertence ao user", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client } = makeSupabase({
      validLeads: { data: [], error: null },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    const { POST } = await import("@/app/api/campaigns/route");
    const res = await POST(
      makeReq({
        name: "Test",
        mode: "template",
        templateText: "Hi",
        leadIds: [VALID_LEAD],
      }),
    );
    expect(res.status).toBe(422);
  });

  it("retorna 201 e dispara processCampaign no happy path", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client } = makeSupabase({
      validLeads: { data: [{ id: VALID_LEAD }], error: null },
      insertResult: { data: { id: "camp-1" }, error: null },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    const { POST } = await import("@/app/api/campaigns/route");
    const res = await POST(
      makeReq({
        name: "Test",
        mode: "template",
        templateText: "Hi {{nome}}",
        leadIds: [VALID_LEAD],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ campaignId: "camp-1" });
    expect(processMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        campaignId: "camp-1",
      }),
    );
  });
});

describe("GET /api/campaigns", () => {
  it("retorna lista de campaigns", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client } = makeSupabase({
      campaignsList: {
        data: [
          { id: "c1", name: "A", mode: "template", status: "completed" },
        ],
        error: null,
      },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    const { GET } = await import("@/app/api/campaigns/route");
    const res = await GET(new Request("http://localhost/api/campaigns"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.campaigns).toHaveLength(1);
  });
});
