import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const enqueueMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/queue/campaigns", () => ({
  enqueueCampaign: enqueueMock,
  CAMPAIGN_TARGETS_QUEUE_NAME: "campaign-targets",
}));

const VALID_LEAD = "11111111-1111-4111-8111-111111111111";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

type CountChainState = "fresh" | "running" | "hour";

function makeSupabase(opts: {
  campaignsList?: { data: unknown; error: unknown };
  validLeads?: { data: unknown; error: unknown };
  insertResult?: { data: unknown; error: unknown };
  insertTargetsError?: unknown;
  runningCount?: number;
  hourCount?: number;
}) {
  const calls: Array<{ table: string; op: string }> = [];
  const leadsInArgs: Array<{ column: string; values: unknown }> = [];
  const leadsEqArgs: Array<{ column: string; value: unknown }> = [];
  const campaignsInsertPayloads: Array<Record<string, unknown>> = [];
  const campaignTargetsInsertPayloads: unknown[] = [];
  const campaignsCountCalls: Array<{
    kind: CountChainState;
    userId: unknown;
    extra?: { column: string; value: unknown };
  }> = [];

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

      const limit = vi.fn(
        async () => opts.campaignsList ?? { data: [], error: null },
      );
      const order = vi.fn(() => ({ limit }));

      const select = vi.fn(
        (
          _columns: string,
          selectOpts?: { count?: string; head?: boolean },
        ) => {
          if (selectOpts?.count === "exact" && selectOpts?.head === true) {
            let state: CountChainState = "fresh";
            let userIdValue: unknown = null;
            let extra: { column: string; value: unknown } | undefined;
            const chain: {
              eq: (column: string, value: unknown) => typeof chain;
              gte: (column: string, value: unknown) => typeof chain;
              then: (
                resolve: (v: { count: number; error: null }) => unknown,
                reject?: (e: unknown) => unknown,
              ) => Promise<unknown>;
            } = {
              eq(column, value) {
                if (column === "user_id") {
                  userIdValue = value;
                } else if (column === "status" && value === "running") {
                  state = "running";
                  extra = { column, value };
                }
                return chain;
              },
              gte(column, value) {
                state = "hour";
                extra = { column, value };
                return chain;
              },
              then(resolve, reject) {
                const count =
                  state === "hour"
                    ? (opts.hourCount ?? 0)
                    : state === "running"
                      ? (opts.runningCount ?? 0)
                      : 0;
                campaignsCountCalls.push({
                  kind: state,
                  userId: userIdValue,
                  extra,
                });
                return Promise.resolve({ count, error: null }).then(
                  resolve,
                  reject,
                );
              },
            };
            return chain;
          }
          return { order };
        },
      );

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
      campaignsCountCalls,
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  supabaseMocks.getUser.mockReset();
  enqueueMock.mockReset();
  enqueueMock.mockResolvedValue({ queuedTargets: 0 });
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
        leadIds: [VALID_LEAD, VALID_LEAD, VALID_LEAD],
      }),
    );

    expect(res.status).toBe(201);
    expect(spies.leadsInArgs).toHaveLength(1);
    expect(spies.leadsInArgs[0]?.values).toEqual([VALID_LEAD]);
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
    expect(spies.leadsEqArgs).toHaveLength(1);
    expect(spies.leadsEqArgs[0]).toEqual({ column: "user_id", value: "u1" });
  });

  it("retorna 201 e enfileira N jobs no happy path (#122)", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client } = makeSupabase({
      validLeads: { data: [{ id: VALID_LEAD }], error: null },
      insertResult: { data: { id: "camp-1" }, error: null },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    enqueueMock.mockResolvedValue({ queuedTargets: 1 });
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
    expect(body).toEqual({ campaignId: "camp-1", queuedTargets: 1 });
    expect(enqueueMock).toHaveBeenCalledWith({
      campaignId: "camp-1",
      userId: "u1",
      targets: [
        expect.objectContaining({
          leadId: VALID_LEAD,
        }),
      ],
    });
  });

  it("INSERT campaigns agora persiste status='running' + started_at (substitui o que processor fazia inline)", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client, spies } = makeSupabase({
      validLeads: { data: [{ id: VALID_LEAD }], error: null },
      insertResult: { data: { id: "camp-1" }, error: null },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    enqueueMock.mockResolvedValue({ queuedTargets: 1 });
    const { POST } = await import("@/app/api/campaigns/route");

    await POST(
      makeReq({
        name: "Test",
        mode: "template",
        templateText: "Hi",
        leadIds: [VALID_LEAD],
      }),
    );

    const insertedCampaign = spies.campaignsInsertPayloads[0];
    expect(insertedCampaign?.status).toBe("running");
    expect(typeof insertedCampaign?.started_at).toBe("string");
  });

  describe("rate-limit por usuário (#134)", () => {
    it("Case A: retorna 409 quando user já tem campanha com status='running'", async () => {
      supabaseMocks.getUser.mockResolvedValue({
        data: { user: { id: "u1" } },
        error: null,
      });
      const { client, spies } = makeSupabase({
        runningCount: 1,
        hourCount: 0,
        validLeads: { data: [{ id: VALID_LEAD }], error: null },
        insertResult: { data: { id: "camp-1" }, error: null },
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

      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("campaign_already_running");

      // Backend deve ter checado runningCount com escopo user_id + status.
      const runningCalls = spies.campaignsCountCalls.filter(
        (c) => c.kind === "running",
      );
      expect(runningCalls).toHaveLength(1);
      expect(runningCalls[0]?.userId).toBe("u1");
      expect(runningCalls[0]?.extra).toEqual({
        column: "status",
        value: "running",
      });

      // Não deve inserir nem enfileirar.
      expect(spies.campaignsInsertPayloads).toHaveLength(0);
      expect(spies.campaignTargetsInsertPayloads).toHaveLength(0);
      expect(enqueueMock).not.toHaveBeenCalled();
    });

    it("Case B: retorna 429 quando user excede MAX_CAMPAIGNS_PER_HOUR (default 5)", async () => {
      supabaseMocks.getUser.mockResolvedValue({
        data: { user: { id: "u1" } },
        error: null,
      });
      const { client, spies } = makeSupabase({
        runningCount: 0,
        hourCount: 5,
        validLeads: { data: [{ id: VALID_LEAD }], error: null },
        insertResult: { data: { id: "camp-1" }, error: null },
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

      expect(res.status).toBe(429);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("rate_limited");
      expect(res.headers.get("Retry-After")).toBe("60");

      // Backend deve ter checado hourCount usando .gte('created_at', ...).
      const hourCalls = spies.campaignsCountCalls.filter(
        (c) => c.kind === "hour",
      );
      expect(hourCalls).toHaveLength(1);
      expect(hourCalls[0]?.userId).toBe("u1");
      expect(hourCalls[0]?.extra?.column).toBe("created_at");

      expect(spies.campaignsInsertPayloads).toHaveLength(0);
      expect(spies.campaignTargetsInsertPayloads).toHaveLength(0);
      expect(enqueueMock).not.toHaveBeenCalled();
    });

    it("Case C: 201 quando user está dentro do limite (sem running e hourCount < MAX)", async () => {
      supabaseMocks.getUser.mockResolvedValue({
        data: { user: { id: "u1" } },
        error: null,
      });
      const { client, spies } = makeSupabase({
        runningCount: 0,
        hourCount: 4,
        validLeads: { data: [{ id: VALID_LEAD }], error: null },
        insertResult: { data: { id: "camp-1" }, error: null },
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

      expect(res.status).toBe(201);
      expect(spies.campaignsInsertPayloads).toHaveLength(1);
      expect(enqueueMock).toHaveBeenCalledOnce();
    });
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
