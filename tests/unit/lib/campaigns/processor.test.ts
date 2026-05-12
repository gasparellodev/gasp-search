import { beforeEach, describe, expect, it, vi } from "vitest";

// Worker (lib/queue/worker.ts) e a rota /api/campaigns chamam apenas
// `processCampaignTarget` (1 target → resultado). O loop foi removido em
// #122 — agora cada target é um job BullMQ. Esses tests garantem que cada
// branch do processador continua correto.

vi.mock("@/lib/env", () => ({
  env: {
    EVOLUTION_API_URL: "http://x",
    EVOLUTION_API_KEY: "k",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  },
}));

const sendMock = vi.fn();
const generateMock = vi.fn();
const dispatchSitePreviewMock = vi.fn();

const { processCampaignTarget } = await import("@/lib/campaigns/processor");

type CampaignRow = {
  id: string;
  status: string;
  type: "message" | "site_preview";
  mode: "template" | "ai_per_lead";
  template_text: string | null;
  ai_channel: string | null;
  ai_tone: string | null;
  ai_goal: string | null;
};

function makeSupabase(opts: {
  campaign?: CampaignRow | null;
  campaignStatusSequence?: string[];
  lead?: Record<string, unknown> | null;
  pendingCount?: number;
  countersInitial?: { sent_count: number; failed_count: number };
}) {
  const updates: Array<{ table: string; payload: unknown; filter?: unknown }> = [];
  let campaignStatusCallIdx = 0;
  const counters = opts.countersInitial ?? { sent_count: 0, failed_count: 0 };
  let pendingRemaining = opts.pendingCount ?? 0;

  const from = vi.fn((table: string) => {
    if (table === "campaigns") {
      return {
        select: vi.fn(
          (
            cols: string,
            selectOpts?: { count?: string; head?: boolean },
          ) => {
            if (selectOpts?.count === "exact" && selectOpts?.head === true) {
              // count helper (pending targets check)
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(async () => ({
                    count: pendingRemaining,
                    error: null,
                  })),
                })),
              };
            }
            // Chain `.eq().maybeSingle()` ou `.eq().eq().maybeSingle()` —
            // defesa em profundidade #122 adiciona filtro extra por user_id.
            const eqLevel = (): {
              eq: ReturnType<typeof vi.fn>;
              maybeSingle: ReturnType<typeof vi.fn>;
            } => {
              const node = {
                eq: vi.fn(() => eqLevel()),
                maybeSingle: vi.fn(async () => {
                  if (cols === "status") {
                    const seq = opts.campaignStatusSequence ?? [];
                    const status = seq[campaignStatusCallIdx] ?? "running";
                    campaignStatusCallIdx++;
                    return { data: { status }, error: null };
                  }
                  if (cols === "sent_count, failed_count") {
                    return { data: { ...counters }, error: null };
                  }
                  return { data: opts.campaign ?? null, error: null };
                }),
              };
              return node;
            };
            return { eq: vi.fn(() => eqLevel()) };
          },
        ),
        update: vi.fn((payload: Record<string, unknown>) => ({
          eq: vi.fn((column: string, value: unknown) => {
            const action = async () => {
              updates.push({
                table,
                payload,
                filter: { [column]: value },
              });
              if (typeof payload.sent_count === "number")
                counters.sent_count = payload.sent_count;
              if (typeof payload.failed_count === "number")
                counters.failed_count = payload.failed_count;
              return { error: null };
            };
            // Permite encadear .eq() pra UPDATE WHERE status='running'
            // (defesa anti-override do estado 'cancelled' em #122 final).
            const chain = {
              eq: vi.fn(async () => {
                await action();
                return { error: null };
              }),
              then: (
                resolve: (v: { error: null }) => unknown,
                reject?: (e: unknown) => unknown,
              ) =>
                action()
                  .then(() => ({ error: null }))
                  .then(resolve, reject),
            };
            return chain;
          }),
        })),
      };
    }
    if (table === "campaign_targets") {
      return {
        select: vi.fn(
          (
            _cols: string,
            selectOpts?: { count?: string; head?: boolean },
          ) => {
            if (selectOpts?.count === "exact" && selectOpts?.head === true) {
              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(async () => ({
                    count: pendingRemaining,
                    error: null,
                  })),
                })),
              };
            }
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ data: [], error: null })),
              })),
            };
          },
        ),
        update: vi.fn((payload: unknown) => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => {
              updates.push({ table, payload });
              pendingRemaining = Math.max(0, pendingRemaining - 1);
              return { error: null };
            }),
          })),
        })),
      };
    }
    if (table === "leads") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: opts.lead ?? null,
              error: null,
            })),
          })),
        })),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });

  return { client: { from }, updates, counters };
}

beforeEach(() => {
  sendMock.mockReset();
  generateMock.mockReset();
  dispatchSitePreviewMock.mockReset();
});

const baseLead = {
  id: "lead-1",
  name: "Bar A",
  city: "SP",
  state: "SP",
  category: "Bar",
  source: "google_maps",
  country: "BR",
  phone: "1199",
  email: null,
  website: null,
  instagram_handle: null,
  whatsapp: null,
  has_website: false,
  rating: null,
  reviews_count: null,
  followers_count: null,
  stage: "new",
  score: 50,
  notes: null,
} as const;

describe("processCampaignTarget — branch 'message'", () => {
  it("template mode: render placeholder e envia via sendImpl com aiGenerated=false", async () => {
    const { client, updates } = makeSupabase({
      campaign: {
        id: "c1",
        status: "running",
        type: "message",
        mode: "template",
        template_text: "Olá {{nome}} de {{cidade}}",
        ai_channel: null,
        ai_tone: null,
        ai_goal: null,
      },
      campaignStatusSequence: ["running"],
      lead: baseLead,
      pendingCount: 1,
    });
    sendMock.mockResolvedValue({
      ok: true,
      messageId: "msg",
      whatsappMsgId: "evo",
    });

    const result = await processCampaignTarget(
      {
        campaignId: "c1",
        userId: "u1",
        leadId: "lead-1",
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient: client as any,
        sendImpl: sendMock,
        generateMessageImpl: generateMock,
        dispatchSitePreviewImpl: dispatchSitePreviewMock,
      },
    );

    expect(result).toEqual({ status: "sent" });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Olá Bar A de SP",
        campaignId: "c1",
        aiGenerated: false,
      }),
    );
    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "campaign_targets",
        payload: expect.objectContaining({ status: "sent" }),
      }),
    );
  });

  it("ai_per_lead mode: chama generateMessage e marca aiGenerated=true", async () => {
    const { client } = makeSupabase({
      campaign: {
        id: "c1",
        status: "running",
        type: "message",
        mode: "ai_per_lead",
        template_text: null,
        ai_channel: "whatsapp",
        ai_tone: "consultivo",
        ai_goal: "iniciar conversa",
      },
      campaignStatusSequence: ["running"],
      lead: baseLead,
      pendingCount: 1,
    });
    generateMock.mockResolvedValue("Texto gerado pela IA");
    sendMock.mockResolvedValue({
      ok: true,
      messageId: "m",
      whatsappMsgId: "e",
    });

    const result = await processCampaignTarget(
      {
        campaignId: "c1",
        userId: "u1",
        leadId: "lead-1",
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient: client as any,
        sendImpl: sendMock,
        generateMessageImpl: generateMock,
        dispatchSitePreviewImpl: dispatchSitePreviewMock,
      },
    );

    expect(result).toEqual({ status: "sent" });
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Bar A" }),
      expect.objectContaining({ channel: "whatsapp", tone: "consultivo" }),
    );
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ content: "Texto gerado pela IA", aiGenerated: true }),
    );
  });

  it("send falha → marca target failed + incrementa counter failed_count", async () => {
    const { client, updates } = makeSupabase({
      campaign: {
        id: "c1",
        status: "running",
        type: "message",
        mode: "template",
        template_text: "x",
        ai_channel: null,
        ai_tone: null,
        ai_goal: null,
      },
      campaignStatusSequence: ["running"],
      lead: baseLead,
      pendingCount: 1,
    });
    sendMock.mockResolvedValue({
      ok: false,
      reason: "evolution_error",
      error: "boom",
    });

    const result = await processCampaignTarget(
      {
        campaignId: "c1",
        userId: "u1",
        leadId: "lead-1",
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient: client as any,
        sendImpl: sendMock,
        generateMessageImpl: generateMock,
        dispatchSitePreviewImpl: dispatchSitePreviewMock,
      },
    );

    expect(result).toEqual({ status: "failed" });
    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "campaign_targets",
        payload: expect.objectContaining({ status: "failed", error_message: "boom" }),
      }),
    );
    // Counter failed_count incrementado
    expect(
      updates.some(
        (u) =>
          u.table === "campaigns" &&
          (u.payload as { failed_count?: number }).failed_count === 1,
      ),
    ).toBe(true);
  });

  it("render/generate falha → conta como failed (não send)", async () => {
    const { client, updates } = makeSupabase({
      campaign: {
        id: "c1",
        status: "running",
        type: "message",
        mode: "ai_per_lead",
        template_text: null,
        ai_channel: "whatsapp",
        ai_tone: "consultivo",
        ai_goal: "x",
      },
      campaignStatusSequence: ["running"],
      lead: baseLead,
      pendingCount: 1,
    });
    generateMock.mockRejectedValue(new Error("anthropic boom"));

    const result = await processCampaignTarget(
      {
        campaignId: "c1",
        userId: "u1",
        leadId: "lead-1",
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient: client as any,
        sendImpl: sendMock,
        generateMessageImpl: generateMock,
        dispatchSitePreviewImpl: dispatchSitePreviewMock,
      },
    );

    expect(result).toEqual({ status: "failed" });
    expect(sendMock).not.toHaveBeenCalled();
    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "campaign_targets",
        payload: expect.objectContaining({
          status: "failed",
          error_message: "anthropic boom",
        }),
      }),
    );
  });

  it("lead removido (lookup retorna null) → 'skipped' com error_message", async () => {
    const { client, updates } = makeSupabase({
      campaign: {
        id: "c1",
        status: "running",
        type: "message",
        mode: "template",
        template_text: "x",
        ai_channel: null,
        ai_tone: null,
        ai_goal: null,
      },
      campaignStatusSequence: ["running"],
      lead: null,
      pendingCount: 1,
    });

    const result = await processCampaignTarget(
      {
        campaignId: "c1",
        userId: "u1",
        leadId: "lead-1",
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient: client as any,
        sendImpl: sendMock,
        generateMessageImpl: generateMock,
        dispatchSitePreviewImpl: dispatchSitePreviewMock,
      },
    );

    expect(result).toEqual({ status: "skipped" });
    expect(sendMock).not.toHaveBeenCalled();
    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "campaign_targets",
        payload: expect.objectContaining({
          status: "skipped",
          error_message: "lead removido",
        }),
      }),
    );
  });
});

describe("processCampaignTarget — branch 'site_preview'", () => {
  it("dispatch ok → marca queue 'sent' + incrementa sent_count", async () => {
    dispatchSitePreviewMock.mockResolvedValue({
      ok: true,
      leadSiteId: "site-1",
    });
    const { client, updates } = makeSupabase({
      campaign: {
        id: "c1",
        status: "running",
        type: "site_preview",
        mode: "template",
        template_text: null,
        ai_channel: null,
        ai_tone: null,
        ai_goal: null,
      },
      campaignStatusSequence: ["running"],
      pendingCount: 1,
    });

    const result = await processCampaignTarget(
      {
        campaignId: "c1",
        userId: "u1",
        leadId: "lead-1",
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient: client as any,
        sendImpl: sendMock,
        generateMessageImpl: generateMock,
        dispatchSitePreviewImpl: dispatchSitePreviewMock,
      },
    );

    expect(result).toEqual({ status: "sent" });
    expect(generateMock).not.toHaveBeenCalled();
    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "campaign_targets",
        payload: expect.objectContaining({ status: "sent" }),
      }),
    );
  });

  it("no_site → marca 'skipped' (não conta failed)", async () => {
    dispatchSitePreviewMock.mockResolvedValue({
      ok: false,
      reason: "no_site",
      message: "Lead não possui site gerado.",
    });
    const { client, updates } = makeSupabase({
      campaign: {
        id: "c1",
        status: "running",
        type: "site_preview",
        mode: "template",
        template_text: null,
        ai_channel: null,
        ai_tone: null,
        ai_goal: null,
      },
      campaignStatusSequence: ["running"],
      pendingCount: 1,
    });

    const result = await processCampaignTarget(
      {
        campaignId: "c1",
        userId: "u1",
        leadId: "lead-1",
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient: client as any,
        sendImpl: sendMock,
        generateMessageImpl: generateMock,
        dispatchSitePreviewImpl: dispatchSitePreviewMock,
      },
    );

    expect(result).toEqual({ status: "skipped" });
    const skipped = updates.find(
      (u) =>
        u.table === "campaign_targets" &&
        (u.payload as { status?: string }).status === "skipped",
    );
    expect(skipped).toBeDefined();
    expect((skipped?.payload as { error_message?: string }).error_message).toMatch(
      /no_site/,
    );
    // Não incrementa failed_count
    expect(
      updates.some(
        (u) =>
          u.table === "campaigns" &&
          typeof (u.payload as { failed_count?: number }).failed_count === "number",
      ),
    ).toBe(false);
  });

  it("rate_limit_daily (#173) → 'failed' (não skipped)", async () => {
    dispatchSitePreviewMock.mockResolvedValue({
      ok: false,
      reason: "rate_limit_daily",
      message: "Limite diário 50 atingido.",
    });
    const { client, updates } = makeSupabase({
      campaign: {
        id: "c1",
        status: "running",
        type: "site_preview",
        mode: "template",
        template_text: null,
        ai_channel: null,
        ai_tone: null,
        ai_goal: null,
      },
      campaignStatusSequence: ["running"],
      pendingCount: 1,
    });

    const result = await processCampaignTarget(
      {
        campaignId: "c1",
        userId: "u1",
        leadId: "lead-1",
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient: client as any,
        sendImpl: sendMock,
        generateMessageImpl: generateMock,
        dispatchSitePreviewImpl: dispatchSitePreviewMock,
      },
    );

    expect(result).toEqual({ status: "failed" });
    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "campaign_targets",
        payload: expect.objectContaining({
          status: "failed",
          error_message: expect.stringMatching(/rate_limit_daily/),
        }),
      }),
    );
  });

  it("dispatch lança throw inesperado → 'failed' com message do erro", async () => {
    dispatchSitePreviewMock.mockRejectedValue(new Error("unexpected boom"));
    const { client, updates } = makeSupabase({
      campaign: {
        id: "c1",
        status: "running",
        type: "site_preview",
        mode: "template",
        template_text: null,
        ai_channel: null,
        ai_tone: null,
        ai_goal: null,
      },
      campaignStatusSequence: ["running"],
      pendingCount: 1,
    });

    const result = await processCampaignTarget(
      {
        campaignId: "c1",
        userId: "u1",
        leadId: "lead-1",
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient: client as any,
        sendImpl: sendMock,
        generateMessageImpl: generateMock,
        dispatchSitePreviewImpl: dispatchSitePreviewMock,
      },
    );

    expect(result).toEqual({ status: "failed" });
    const failed = updates.find(
      (u) =>
        u.table === "campaign_targets" &&
        (u.payload as { status?: string }).status === "failed",
    );
    expect((failed?.payload as { error_message?: string }).error_message).toContain(
      "unexpected boom",
    );
  });
});

describe("processCampaignTarget — controle de estado", () => {
  it("campanha cancelada → no-op, não toca send/dispatch/target", async () => {
    const { client, updates } = makeSupabase({
      campaign: {
        id: "c1",
        status: "cancelled",
        type: "message",
        mode: "template",
        template_text: "x",
        ai_channel: null,
        ai_tone: null,
        ai_goal: null,
      },
      campaignStatusSequence: ["cancelled"],
      lead: baseLead,
      pendingCount: 1,
    });

    const result = await processCampaignTarget(
      {
        campaignId: "c1",
        userId: "u1",
        leadId: "lead-1",
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient: client as any,
        sendImpl: sendMock,
        generateMessageImpl: generateMock,
        dispatchSitePreviewImpl: dispatchSitePreviewMock,
      },
    );

    expect(result).toEqual({ status: "cancelled" });
    expect(sendMock).not.toHaveBeenCalled();
    expect(dispatchSitePreviewMock).not.toHaveBeenCalled();
    expect(
      updates.find((u) => u.table === "campaign_targets"),
    ).toBeUndefined();
  });

  it("#122 segurança: query da campanha filtra por user_id (defesa em profundidade)", async () => {
    // O processor roda com service_role (bypassa RLS). Para evitar que um
    // job com user_id divergente da campanha cause envio "cruzado", o
    // SELECT inclui `.eq('user_id', job.userId)`. Mockamos um cliente que
    // captura as chamadas `.eq(...)` para asserção.
    const eqCalls: Array<{ column: string; value: unknown }> = [];
    const fakeClient = {
      from: vi.fn((table: string) => {
        if (table === "campaigns") {
          return {
            select: vi.fn(
              (
                _cols: string,
                selectOpts?: { count?: string; head?: boolean },
              ) => {
                if (selectOpts?.count === "exact" && selectOpts?.head === true) {
                  return {
                    eq: () => ({ eq: async () => ({ count: 0, error: null }) }),
                  };
                }
                const eqLevel = (): {
                  eq: (col: string, val: unknown) => unknown;
                  maybeSingle: () => Promise<{ data: null; error: null }>;
                } => ({
                  eq: (col: string, val: unknown) => {
                    eqCalls.push({ column: col, value: val });
                    return eqLevel();
                  },
                  maybeSingle: async () => ({ data: null, error: null }),
                });
                return { eq: (col: string, val: unknown) => {
                  eqCalls.push({ column: col, value: val });
                  return eqLevel();
                } };
              },
            ),
            update: vi.fn(() => ({ eq: async () => ({ error: null }) })),
          };
        }
        if (table === "campaign_targets") {
          return {
            select: vi.fn(
              (
                _cols: string,
                selectOpts?: { count?: string; head?: boolean },
              ) => ({
                eq: () => ({
                  eq: async () => ({
                    count: selectOpts?.count === "exact" ? 0 : null,
                    error: null,
                  }),
                }),
              }),
            ),
          };
        }
        return { select: vi.fn(), update: vi.fn() };
      }),
    };

    await processCampaignTarget(
      {
        campaignId: "c1",
        userId: "u-trusted",
        leadId: "lead-1",
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient: fakeClient as any,
        sendImpl: sendMock,
        generateMessageImpl: generateMock,
        dispatchSitePreviewImpl: dispatchSitePreviewMock,
      },
    );

    // Asserção crítica: a query da campanha deve incluir `.eq('user_id', job.userId)`.
    expect(eqCalls).toContainEqual({ column: "id", value: "c1" });
    expect(eqCalls).toContainEqual({ column: "user_id", value: "u-trusted" });
  });

  it("campanha não-existente → no-op { status: 'skipped' }", async () => {
    const { client, updates } = makeSupabase({
      campaign: null,
      pendingCount: 0,
    });

    const result = await processCampaignTarget(
      {
        campaignId: "missing",
        userId: "u1",
        leadId: "lead-1",
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient: client as any,
        sendImpl: sendMock,
        generateMessageImpl: generateMock,
        dispatchSitePreviewImpl: dispatchSitePreviewMock,
      },
    );

    expect(result).toEqual({ status: "skipped" });
    expect(sendMock).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("último target completado → marca campaign 'completed'", async () => {
    const { client, updates } = makeSupabase({
      campaign: {
        id: "c1",
        status: "running",
        type: "message",
        mode: "template",
        template_text: "x",
        ai_channel: null,
        ai_tone: null,
        ai_goal: null,
      },
      // 1 status check inicial + 1 final (decide se sobrescreve com completed)
      campaignStatusSequence: ["running", "running"],
      lead: baseLead,
      pendingCount: 1,
    });
    sendMock.mockResolvedValue({
      ok: true,
      messageId: "m",
      whatsappMsgId: "e",
    });

    await processCampaignTarget(
      {
        campaignId: "c1",
        userId: "u1",
        leadId: "lead-1",
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient: client as any,
        sendImpl: sendMock,
        generateMessageImpl: generateMock,
        dispatchSitePreviewImpl: dispatchSitePreviewMock,
      },
    );

    expect(updates).toContainEqual(
      expect.objectContaining({
        table: "campaigns",
        payload: expect.objectContaining({ status: "completed" }),
      }),
    );
  });

  it("último target mas campanha já 'cancelled' no fim → NÃO sobrescreve com 'completed'", async () => {
    const { client, updates } = makeSupabase({
      campaign: {
        id: "c1",
        status: "running",
        type: "message",
        mode: "template",
        template_text: "x",
        ai_channel: null,
        ai_tone: null,
        ai_goal: null,
      },
      // Final status check (após pending=0) detecta 'cancelled' → UPDATE skip.
      campaignStatusSequence: ["cancelled"],
      lead: baseLead,
      pendingCount: 1,
    });
    sendMock.mockResolvedValue({
      ok: true,
      messageId: "m",
      whatsappMsgId: "e",
    });

    await processCampaignTarget(
      {
        campaignId: "c1",
        userId: "u1",
        leadId: "lead-1",
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient: client as any,
        sendImpl: sendMock,
        generateMessageImpl: generateMock,
        dispatchSitePreviewImpl: dispatchSitePreviewMock,
      },
    );

    expect(
      updates.find(
        (u) =>
          u.table === "campaigns" &&
          (u.payload as { status?: string }).status === "completed",
      ),
    ).toBeUndefined();
  });

  it("não é o último target (pending > 0 após update) → NÃO marca completed ainda", async () => {
    const { client, updates } = makeSupabase({
      campaign: {
        id: "c1",
        status: "running",
        type: "message",
        mode: "template",
        template_text: "x",
        ai_channel: null,
        ai_tone: null,
        ai_goal: null,
      },
      campaignStatusSequence: ["running"],
      lead: baseLead,
      // 2 pending — após processar 1, ainda resta 1.
      pendingCount: 2,
    });
    sendMock.mockResolvedValue({
      ok: true,
      messageId: "m",
      whatsappMsgId: "e",
    });

    await processCampaignTarget(
      {
        campaignId: "c1",
        userId: "u1",
        leadId: "lead-1",
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceClient: client as any,
        sendImpl: sendMock,
        generateMessageImpl: generateMock,
        dispatchSitePreviewImpl: dispatchSitePreviewMock,
      },
    );

    expect(
      updates.find(
        (u) =>
          u.table === "campaigns" &&
          (u.payload as { status?: string }).status === "completed",
      ),
    ).toBeUndefined();
  });
});
