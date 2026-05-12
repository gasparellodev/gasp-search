import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock BullMQ — `Queue` constructor + `add` + `addBulk`. Mantemos um único
// `addMock`/`addBulkMock` compartilhado pra inspecionar payloads.
const addMock = vi.fn(async (name: string, data: unknown) => ({
  id: `job-${name}`,
  data,
}));
const addBulkMock = vi.fn(async (entries: Array<{ name: string; data: unknown }>) =>
  entries.map((e, i) => ({ id: `job-${i}`, name: e.name, data: e.data })),
);
const closeMock = vi.fn(async () => undefined);
const QueueCtor = vi.fn();

vi.mock("bullmq", () => ({
  Queue: function (this: unknown, name: string, opts: unknown) {
    QueueCtor(name, opts);
    return {
      name,
      add: addMock,
      addBulk: addBulkMock,
      close: closeMock,
    };
  },
}));

// Stub do client ioredis (não conecta de verdade).
vi.mock("@/lib/queue/redis", () => ({
  getRedis: vi.fn(() => ({ _stub: true })),
}));

beforeEach(() => {
  vi.resetModules();
  addMock.mockClear();
  addBulkMock.mockClear();
  closeMock.mockClear();
  QueueCtor.mockClear();
});

describe("lib/queue/campaigns", () => {
  it("inicializa Queue<'campaign-targets'> com a conexão Redis e defaults sensatos", async () => {
    await import("@/lib/queue/campaigns");
    expect(QueueCtor).toHaveBeenCalledTimes(1);
    expect(QueueCtor).toHaveBeenCalledWith(
      "campaign-targets",
      expect.objectContaining({
        connection: expect.any(Object),
      }),
    );
    // defaultJobOptions: retry com backoff exponencial. Job não deve travar
    // a fila inteira em caso de erro transitório de Anthropic/Evolution.
    const opts = (QueueCtor.mock.calls[0]?.[1] ?? {}) as {
      defaultJobOptions?: { attempts?: number; backoff?: unknown; removeOnComplete?: unknown };
    };
    expect(opts.defaultJobOptions?.attempts).toBeGreaterThanOrEqual(3);
    expect(opts.defaultJobOptions?.backoff).toBeDefined();
    expect(opts.defaultJobOptions?.removeOnComplete).toBeDefined();
  });

  it("enqueueCampaign() enfileira 1 job por target via addBulk e retorna queuedTargets", async () => {
    const { enqueueCampaign } = await import("@/lib/queue/campaigns");
    const result = await enqueueCampaign({
      campaignId: "c1",
      userId: "u1",
      targets: [
        { leadId: "lead-1" },
        { leadId: "lead-2" },
        { leadId: "lead-3" },
      ],
    });
    expect(result).toEqual({ queuedTargets: 3 });
    expect(addBulkMock).toHaveBeenCalledTimes(1);
    const entries = addBulkMock.mock.calls[0]?.[0] as Array<{ name: string; data: unknown }>;
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({
      name: "campaign-target",
      data: {
        campaignId: "c1",
        userId: "u1",
        leadId: "lead-1",
      },
      opts: expect.any(Object),
    });
  });

  it("enqueueCampaign() com array vazio retorna { queuedTargets: 0 } e não chama BullMQ", async () => {
    const { enqueueCampaign } = await import("@/lib/queue/campaigns");
    const result = await enqueueCampaign({
      campaignId: "c1",
      userId: "u1",
      targets: [],
    });
    expect(result).toEqual({ queuedTargets: 0 });
    expect(addBulkMock).not.toHaveBeenCalled();
    expect(addMock).not.toHaveBeenCalled();
  });

  it("cada job recebe jobId determinístico para idempotência (campaignId:leadId)", async () => {
    const { enqueueCampaign } = await import("@/lib/queue/campaigns");
    await enqueueCampaign({
      campaignId: "c1",
      userId: "u1",
      targets: [{ leadId: "lead-1" }],
    });
    const entries = addBulkMock.mock.calls[0]?.[0] as Array<{
      name: string;
      data: unknown;
      opts: { jobId?: string };
    }>;
    expect(entries[0]?.opts.jobId).toBe("c1:lead-1");
  });

  it("exporta CAMPAIGN_TARGETS_QUEUE_NAME consistente com o worker", async () => {
    const { CAMPAIGN_TARGETS_QUEUE_NAME } = await import(
      "@/lib/queue/campaigns"
    );
    expect(CAMPAIGN_TARGETS_QUEUE_NAME).toBe("campaign-targets");
  });
});
