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
  const leadsInArgs: Array<{ column: string; values: unknown }> = [];
  const leadsEqArgs: Array<{ column: string; value: unknown }> = [];
  const campaignsInsertPayloads: Array<Record<string, unknown>> = [];
  const campaignTargetsInsertPayloads: unknown[] = [];

  const from = vi.fn((table: string) => {
    if (table === "campaigns") {
      const insertSelectSingle = vi.fn(async () => ({
        data: opts.insertResult?.data ?? { id: "camp-1" },
        error: opts.insertResult?.error ?? null,
      }));
      const insertSelect = vi.fn(() => ({ single: insertSelectSingle }));
      const insert = vi.fn((payload: Record<string, unknown>) => {
        calls.push({ table, op: "insert" });
        campaignsInsertPayloads.push(payload);
        return { select: insertSelect };
      });
      // GET list
      const limit = vi.fn(async () => opts.campaignsList ?? { data: [], error: null });
      const order = vi.fn(() => ({ limit }));
      const select = vi.fn(() => ({ order }));
      return { select, insert };
    }
    if (table === "leads") {
      const eqHandler = vi.fn(async (column: string, value: unknown) => {
        leadsEqArgs.push({ column, value });
        return opts.validLeads ?? { data: [], error: null };
      });
      const inHandler = vi.fn((column: string, values: unknown) => {
        leadsInArgs.push({ column, values });
        return { eq: eqHandler };
      });
      const select = vi.fn(() => ({ in: inHandler }));
      return { select };
    }
    if (table === "campaign_targets") {
      const insert = vi.fn(async (payload: unknown) => {
        campaignTargetsInsertPayloads.push(payload);
        return {
          error: opts.insertTargetsError ?? null,
        };
      });
      return { insert };
    }
    throw new Error(`unexpected ${table}`);
  });

  return {
    client: { auth: { getUser: supabaseMocks.getUser }, from },
    spies: {
      from,
      calls,
      leadsInArgs,
      leadsEqArgs,
      campaignsInsertPayloads,
      campaignTargetsInsertPayloads,
    },
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

  it("dedup leadIds antes de validar — payload com duplicatas é aceito após dedup (#129)", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    // Supabase retorna 1 row (única) mesmo quando a query recebe duplicatas;
    // backend deve deduplicar ANTES da query e comparar contra o tamanho do Set.
    const { client, spies } = makeSupabase({
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
        leadIds: [VALID_LEAD, VALID_LEAD, VALID_LEAD], // duplicatas explícitas
      }),
    );

    expect(res.status).toBe(201);
    // A query .in('id', ids) deve ter recebido a lista deduplicada.
    expect(spies.leadsInArgs).toHaveLength(1);
    expect(spies.leadsInArgs[0]?.values).toEqual([VALID_LEAD]);
    // total_count e targets também devem refletir o conjunto único.
    const campaignPayload = spies.campaignsInsertPayloads[0];
    expect(campaignPayload?.total_count).toBe(1);
    const targets = spies.campaignTargetsInsertPayloads[0] as Array<{
      lead_id: string;
    }>;
    expect(targets).toHaveLength(1);
    expect(targets[0]?.lead_id).toBe(VALID_LEAD);
  });

  it("escopo da query de validação por user_id — defesa em profundidade vs cross-tenant (#129)", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    // Simula que o lead requisitado NÃO pertence ao user u1: Supabase
    // (com .eq('user_id', 'u1') e RLS) retorna zero rows. Backend deve
    // rejeitar com mensagem amigável.
    const { client, spies } = makeSupabase({
      validLeads: { data: [], error: null },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    const { POST } = await import("@/app/api/campaigns/route");

    const LEAD_FROM_OTHER_USER = "22222222-2222-4222-8222-222222222222";
    const res = await POST(
      makeReq({
        name: "Test",
        mode: "template",
        templateText: "Hi",
        leadIds: [LEAD_FROM_OTHER_USER],
      }),
    );

    expect(res.status).toBe(422);
    // Defesa em profundidade: backend filtrou explicitamente por user_id,
    // não confiou só em RLS.
    expect(spies.leadsEqArgs).toHaveLength(1);
    expect(spies.leadsEqArgs[0]).toEqual({ column: "user_id", value: "u1" });
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
