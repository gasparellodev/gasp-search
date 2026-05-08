import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

type ChainResult = { data: unknown; error: unknown };

function makeSupabase(opts: {
  campaign?: ChainResult;
  targets?: ChainResult;
  cancelResult?: ChainResult;
}) {
  // GET path: from('campaigns').select(...).eq(...).maybeSingle()
  //          + from('campaign_targets').select(...).eq(...).order(...)
  // PATCH path: from('campaigns').update(...).eq(...).select(...).maybeSingle()
  const campaignMaybeSingle = vi.fn(async () =>
    opts.campaign ?? { data: null, error: null },
  );
  const campaignEq = vi.fn(() => ({ maybeSingle: campaignMaybeSingle }));
  const campaignSelectAfterUpdate = vi.fn(() => ({
    maybeSingle: vi.fn(async () =>
      opts.cancelResult ?? { data: null, error: null },
    ),
  }));
  const campaignUpdateEq = vi.fn(() => ({ select: campaignSelectAfterUpdate }));
  const campaignUpdate = vi.fn(() => ({ eq: campaignUpdateEq }));
  const campaignSelect = vi.fn(() => ({ eq: campaignEq }));

  const targetsOrder = vi.fn(async () => opts.targets ?? { data: [], error: null });
  const targetsEq = vi.fn(() => ({ order: targetsOrder }));
  const targetsSelect = vi.fn(() => ({ eq: targetsEq }));

  const from = vi.fn((table: string) => {
    if (table === "campaigns") {
      return { select: campaignSelect, update: campaignUpdate };
    }
    if (table === "campaign_targets") {
      return { select: targetsSelect };
    }
    throw new Error(`unexpected table ${table}`);
  });

  return {
    client: { auth: { getUser: supabaseMocks.getUser }, from },
    spies: {
      from,
      campaignSelect,
      campaignEq,
      campaignMaybeSingle,
      campaignUpdate,
      campaignUpdateEq,
      campaignSelectAfterUpdate,
      targetsSelect,
      targetsEq,
      targetsOrder,
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
});

describe("GET /api/campaigns/[id]", () => {
  it("retorna 401 sem usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    supabaseMocks.createServerSupabase.mockResolvedValue({
      auth: { getUser: supabaseMocks.getUser },
    });
    const { GET } = await import("@/app/api/campaigns/[id]/route");
    const res = await GET(new Request("http://localhost/api/campaigns/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(401);
  });

  it("retorna 404 quando campanha não existe (RLS)", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client } = makeSupabase({ campaign: { data: null, error: null } });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    const { GET } = await import("@/app/api/campaigns/[id]/route");
    const res = await GET(new Request("http://localhost/api/campaigns/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(404);
  });

  it("happy path: retorna campaign + targets", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const campaign = {
      id: "camp-1",
      name: "Test",
      mode: "template",
      status: "running",
      total_count: 2,
      sent_count: 1,
      failed_count: 0,
    };
    const targets = [
      { lead_id: "l1", status: "sent" },
      { lead_id: "l2", status: "queued" },
    ];
    const { client } = makeSupabase({
      campaign: { data: campaign, error: null },
      targets: { data: targets, error: null },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    const { GET } = await import("@/app/api/campaigns/[id]/route");
    const res = await GET(
      new Request("http://localhost/api/campaigns/camp-1"),
      { params: Promise.resolve({ id: "camp-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.campaign).toMatchObject({ id: "camp-1", status: "running" });
    expect(body.targets).toHaveLength(2);
  });
});

describe("PATCH /api/campaigns/[id]", () => {
  it("retorna 401 sem usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    supabaseMocks.createServerSupabase.mockResolvedValue({
      auth: { getUser: supabaseMocks.getUser },
    });
    const { PATCH } = await import("@/app/api/campaigns/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/campaigns/abc", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      }),
      { params: Promise.resolve({ id: "abc" }) },
    );
    expect(res.status).toBe(401);
  });

  it("cancel: atualiza status para 'cancelled' e devolve 200", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client, spies } = makeSupabase({
      cancelResult: {
        data: { id: "camp-1", status: "cancelled" },
        error: null,
      },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    const { PATCH } = await import("@/app/api/campaigns/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/campaigns/camp-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      }),
      { params: Promise.resolve({ id: "camp-1" }) },
    );
    expect(res.status).toBe(200);
    expect(spies.campaignUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" }),
    );
    const body = await res.json();
    expect(body.campaign).toMatchObject({ status: "cancelled" });
  });

  it("cancel em campanha inexistente devolve 404", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client } = makeSupabase({
      cancelResult: { data: null, error: null },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    const { PATCH } = await import("@/app/api/campaigns/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/campaigns/missing", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      }),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(res.status).toBe(404);
  });

  it("body inválido devolve 400", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    supabaseMocks.createServerSupabase.mockResolvedValue({
      auth: { getUser: supabaseMocks.getUser },
    });
    const { PATCH } = await import("@/app/api/campaigns/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/campaigns/x", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
      { params: Promise.resolve({ id: "x" }) },
    );
    expect(res.status).toBe(400);
  });
});
