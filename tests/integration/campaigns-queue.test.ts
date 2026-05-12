import { beforeEach, describe, expect, it, vi } from "vitest";

// ----------------------------------------------------------------------------
// Stitching test (#122): enqueueCampaign → worker handler → processCampaignTarget.
//
// Cobre a costura entre `lib/queue/campaigns.ts`, `lib/queue/worker.ts` e
// `lib/campaigns/processor.ts` sem depender de Redis real. BullMQ é mockado
// in-memory (Queue + Worker constructor). Evolution `sendWhatsAppMessage` é
// stubado pra simular sucesso/falha por target. Updates de `campaigns` /
// `campaign_targets` são gravados num registro em memória (proxy para o
// "estado realtime" — UI assina `campaigns` via Supabase Realtime e vê
// counters atualizando a cada UPDATE).
// ----------------------------------------------------------------------------

vi.mock("@/lib/env", () => ({
  env: {
    EVOLUTION_API_URL: "http://x",
    EVOLUTION_API_KEY: "k",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  },
}));

const queuedJobs: Array<{ name: string; data: unknown; opts: unknown }> = [];

vi.mock("bullmq", () => {
  return {
    Queue: function (this: unknown, name: string) {
      return {
        name,
        addBulk: vi.fn(async (entries: typeof queuedJobs) => {
          queuedJobs.push(...entries);
          return entries.map((e, i) => ({ id: `job-${i}`, ...e }));
        }),
        add: vi.fn(),
        close: vi.fn(),
      };
    },
    // Worker não é construído neste teste — apenas o handler equivalente.
    Worker: function () {
      return { on: vi.fn(), close: vi.fn() };
    },
  };
});

vi.mock("@/lib/queue/redis", () => ({
  getRedis: vi.fn(() => ({ _stub: true })),
}));

const { enqueueCampaign } = await import("@/lib/queue/campaigns");
const { processCampaignTarget } = await import("@/lib/campaigns/processor");

const baseLead = {
  id: "lead-1",
  name: "Lead A",
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
};

type CampaignState = {
  id: string;
  status: string;
  type: "message";
  mode: "template";
  template_text: string;
  ai_channel: null;
  ai_tone: null;
  ai_goal: null;
  sent_count: number;
  failed_count: number;
};

function makeInMemorySupabase(initialCampaign: CampaignState) {
  const campaign = { ...initialCampaign };
  let pendingTargets = 0;
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];

  const from = (table: string) => {
    if (table === "campaigns") {
      return {
        select: (
          cols: string,
          opts?: { count?: string; head?: boolean },
        ) => {
          if (opts?.count === "exact" && opts?.head === true) {
            return {
              eq: () => ({
                eq: async () => ({ count: pendingTargets, error: null }),
              }),
            };
          }
          // `.eq().maybeSingle()` ou `.eq().eq().maybeSingle()` (defesa em
          // profundidade #122).
          type EqNode = {
            eq: () => EqNode;
            maybeSingle: () => Promise<{ data: unknown; error: null }>;
          };
          const eqLevel = (): EqNode => ({
            eq: () => eqLevel(),
            maybeSingle: async () => {
              if (cols === "status") {
                return { data: { status: campaign.status }, error: null };
              }
              if (cols === "sent_count, failed_count") {
                return {
                  data: {
                    sent_count: campaign.sent_count,
                    failed_count: campaign.failed_count,
                  },
                  error: null,
                };
              }
              return { data: campaign, error: null };
            },
          });
          return { eq: () => eqLevel() };
        },
        update: (payload: Record<string, unknown>) => ({
          eq: async () => {
            updates.push({ table, payload });
            if (typeof payload.status === "string") {
              campaign.status = payload.status;
            }
            if (typeof payload.sent_count === "number") {
              campaign.sent_count = payload.sent_count;
            }
            if (typeof payload.failed_count === "number") {
              campaign.failed_count = payload.failed_count;
            }
            return { error: null };
          },
        }),
      };
    }
    if (table === "campaign_targets") {
      return {
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === "exact" && opts?.head === true) {
            return {
              eq: () => ({
                eq: async () => ({ count: pendingTargets, error: null }),
              }),
            };
          }
          return { eq: () => ({ eq: async () => ({ data: [], error: null }) }) };
        },
        update: (payload: Record<string, unknown>) => ({
          eq: () => ({
            eq: async () => {
              updates.push({ table, payload });
              pendingTargets = Math.max(0, pendingTargets - 1);
              return { error: null };
            },
          }),
        }),
      };
    }
    if (table === "leads") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: baseLead, error: null }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  };

  return {
    client: { from },
    state: campaign,
    updates,
    setPending: (n: number) => {
      pendingTargets = n;
    },
  };
}

beforeEach(() => {
  queuedJobs.length = 0;
});

describe("#122: enqueue → worker handler → counters (stitching)", () => {
  it("3 targets — 2 ok + 1 fail → counters chegam a sent=2, failed=1; status='completed'", async () => {
    const supabaseMock = makeInMemorySupabase({
      id: "c1",
      status: "running",
      type: "message",
      mode: "template",
      template_text: "Olá {{nome}}",
      ai_channel: null,
      ai_tone: null,
      ai_goal: null,
      sent_count: 0,
      failed_count: 0,
    });

    // 1) Enqueue 3 targets — verifica o contrato da fila.
    const { queuedTargets } = await enqueueCampaign({
      campaignId: "c1",
      userId: "u1",
      targets: [
        { leadId: "lead-1" },
        { leadId: "lead-2" },
        { leadId: "lead-3" },
      ],
    });
    expect(queuedTargets).toBe(3);
    expect(queuedJobs).toHaveLength(3);
    expect(queuedJobs[0]?.opts).toEqual(
      expect.objectContaining({ jobId: "c1:lead-1" }),
    );

    // 2) Processa cada job na ordem (simula worker concurrency=1).
    supabaseMock.setPending(3);
    const sendMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, messageId: "m1", whatsappMsgId: "w1" })
      .mockResolvedValueOnce({ ok: false, reason: "evolution_error", error: "boom" })
      .mockResolvedValueOnce({ ok: true, messageId: "m3", whatsappMsgId: "w3" });

    const results = [];
    for (const job of queuedJobs) {
      const result = await processCampaignTarget(
        job.data as Parameters<typeof processCampaignTarget>[0],
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          serviceClient: supabaseMock.client as any,
          sendImpl: sendMock,
        },
      );
      results.push(result);
    }

    // 3) Asserções de estado final — equivalente ao que a UI veria via Realtime.
    expect(results.map((r) => r.status)).toEqual(["sent", "failed", "sent"]);
    expect(supabaseMock.state.sent_count).toBe(2);
    expect(supabaseMock.state.failed_count).toBe(1);
    expect(supabaseMock.state.status).toBe("completed");

    // Cada job emitiu pelo menos 1 update em campaigns (counter ou status).
    const campaignUpdates = supabaseMock.updates.filter(
      (u) => u.table === "campaigns",
    );
    // Pelo menos: 2 sent_count + 1 failed_count + 1 status='completed' = 4 updates.
    expect(campaignUpdates.length).toBeGreaterThanOrEqual(4);
  });

  it("enqueue com targets vazio retorna 0 e não chama BullMQ", async () => {
    const { queuedTargets } = await enqueueCampaign({
      campaignId: "c2",
      userId: "u1",
      targets: [],
    });
    expect(queuedTargets).toBe(0);
    expect(queuedJobs).toHaveLength(0);
  });
});
