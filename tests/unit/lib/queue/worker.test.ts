import { beforeEach, describe, expect, it, vi } from "vitest";

// Captura o handler passado pro Worker constructor pra testá-lo isolado.
let capturedHandler:
  | ((job: { id: string; name: string; data: unknown }) => Promise<unknown>)
  | null = null;
let capturedOpts: unknown = null;
const onMock = vi.fn();
const closeMock = vi.fn(async () => undefined);

vi.mock("bullmq", () => ({
  Worker: function (
    this: unknown,
    name: string,
    handler: (job: { id: string; name: string; data: unknown }) => Promise<unknown>,
    opts: unknown,
  ) {
    capturedHandler = handler;
    capturedOpts = opts;
    return {
      name,
      on: onMock,
      close: closeMock,
    };
  },
  // Queue precisa existir porque `lib/queue/campaigns.ts` é importado
  // transitivamente por `worker.ts` (re-export do queue name + tipo).
  Queue: function (this: unknown, name: string) {
    return {
      name,
      add: vi.fn(),
      addBulk: vi.fn(),
      close: vi.fn(),
    };
  },
}));

vi.mock("@/lib/queue/redis", () => ({
  getRedis: vi.fn(() => ({ _stub: true })),
}));

const processCampaignTargetMock = vi.fn();
vi.mock("@/lib/campaigns/processor", () => ({
  processCampaignTarget: processCampaignTargetMock,
}));

beforeEach(() => {
  vi.resetModules();
  capturedHandler = null;
  capturedOpts = null;
  onMock.mockClear();
  closeMock.mockClear();
  processCampaignTargetMock.mockReset();
});

describe("lib/queue/worker", () => {
  it("cria Worker('campaign-targets', handler, opts) com connection + concurrency + limiter (anti-ban)", async () => {
    await import("@/lib/queue/worker");
    expect(capturedHandler).toBeInstanceOf(Function);
    const opts = capturedOpts as {
      connection: unknown;
      concurrency: number;
      limiter?: { max: number; duration: number };
    };
    expect(opts.connection).toBeDefined();
    // 1 job por vez — Anthropic + Evolution não tolera concorrência alta.
    expect(opts.concurrency).toBe(1);
    // Limiter casa com EVOLUTION_DEFAULT_THROTTLE_MS (3s) — 1 mensagem a cada 3s.
    expect(opts.limiter).toEqual({ max: 1, duration: 3_000 });
  });

  it("registra listeners 'completed' e 'failed' para observabilidade", async () => {
    await import("@/lib/queue/worker");
    const events = onMock.mock.calls.map((c) => c[0]);
    expect(events).toContain("completed");
    expect(events).toContain("failed");
  });

  it("handler delega pro processCampaignTarget passando o job.data", async () => {
    await import("@/lib/queue/worker");
    expect(capturedHandler).toBeInstanceOf(Function);
    processCampaignTargetMock.mockResolvedValue({ status: "sent" });

    const result = await capturedHandler!({
      id: "j1",
      name: "campaign-target",
      data: {
        campaignId: "c1",
        userId: "u1",
        leadId: "lead-1",
      },
    });

    expect(processCampaignTargetMock).toHaveBeenCalledWith({
      campaignId: "c1",
      userId: "u1",
      leadId: "lead-1",
    });
    expect(result).toEqual({ status: "sent" });
  });

  it("handler propaga erros do processCampaignTarget pra BullMQ tratar retry/backoff", async () => {
    await import("@/lib/queue/worker");
    processCampaignTargetMock.mockRejectedValue(new Error("boom"));
    await expect(
      capturedHandler!({
        id: "j2",
        name: "campaign-target",
        data: {
          campaignId: "c1",
          userId: "u1",
          leadId: "lead-2",
        },
      }),
    ).rejects.toThrow("boom");
  });

  it("listener 'completed' loga status + ids do job", async () => {
    await import("@/lib/queue/worker");
    const completedCb = onMock.mock.calls.find((c) => c[0] === "completed")?.[1] as
      | ((
          job: { id: string; data: { campaignId: string; leadId: string } },
          result: unknown,
        ) => void)
      | undefined;
    expect(completedCb).toBeInstanceOf(Function);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    completedCb!(
      { id: "j1", data: { campaignId: "c1", leadId: "lead-1" } },
      { status: "sent" },
    );
    // Captura status='sent' do payload e id do job.
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringMatching(/j1 completed \(status=sent\)/),
      expect.objectContaining({ campaignId: "c1", leadId: "lead-1" }),
    );
    // Cobre o branch "result não-objeto" (fallback "ok").
    completedCb!(
      { id: "j2", data: { campaignId: "c1", leadId: "lead-2" } },
      null,
    );
    expect(infoSpy).toHaveBeenLastCalledWith(
      expect.stringMatching(/status=ok/),
      expect.any(Object),
    );
    infoSpy.mockRestore();
  });

  it("listener 'failed' loga error message + attemptsMade", async () => {
    await import("@/lib/queue/worker");
    const failedCb = onMock.mock.calls.find((c) => c[0] === "failed")?.[1] as
      | ((
          job: { id: string; data: { campaignId: string; leadId: string }; attemptsMade: number } | undefined,
          err: Error,
        ) => void)
      | undefined;
    expect(failedCb).toBeInstanceOf(Function);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    failedCb!(
      {
        id: "j3",
        data: { campaignId: "c1", leadId: "lead-3" },
        attemptsMade: 2,
      },
      new Error("evolution down"),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/j3 failed: evolution down/),
      expect.objectContaining({ attemptsMade: 2 }),
    );
    // Branch job=undefined (BullMQ pode emitir failed sem o job).
    failedCb!(undefined, new Error("connection lost"));
    expect(errorSpy).toHaveBeenLastCalledWith(
      expect.stringMatching(/\? failed: connection lost/),
      expect.objectContaining({ attemptsMade: undefined }),
    );
    errorSpy.mockRestore();
  });

  it("listener 'error' loga error message (queue-level, sem job)", async () => {
    await import("@/lib/queue/worker");
    const errorCb = onMock.mock.calls.find((c) => c[0] === "error")?.[1] as
      | ((err: Error) => void)
      | undefined;
    expect(errorCb).toBeInstanceOf(Function);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    errorCb!(new Error("redis EAI_AGAIN"));
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/worker error: redis EAI_AGAIN/),
    );
    errorSpy.mockRestore();
  });

  it("SIGINT/SIGTERM disparam worker.close() graceful (process.exit mocado)", async () => {
    // Captura os handlers registrados em process.on antes do import.
    const processOnSpy = vi.spyOn(process, "on");
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as unknown as typeof process.exit);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await import("@/lib/queue/worker");

    const sigintCall = processOnSpy.mock.calls.find((c) => c[0] === "SIGINT");
    const sigtermCall = processOnSpy.mock.calls.find((c) => c[0] === "SIGTERM");
    expect(sigintCall).toBeDefined();
    expect(sigtermCall).toBeDefined();

    // Caso happy: close resolve normalmente.
    closeMock.mockResolvedValueOnce(undefined);
    const sigintHandler = sigintCall![1] as () => void;
    sigintHandler();
    // Espera microtasks (shutdown é async dentro do handler).
    await new Promise((r) => setTimeout(r, 0));
    expect(closeMock).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringMatching(/received SIGINT/),
    );
    expect(exitSpy).toHaveBeenCalledWith(0);

    // Caso erro: close lança — captura sem propagar pro process.
    closeMock.mockRejectedValueOnce(new Error("close failed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sigtermHandler = sigtermCall![1] as () => void;
    sigtermHandler();
    await new Promise((r) => setTimeout(r, 0));
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/error closing worker: close failed/),
    );

    processOnSpy.mockRestore();
    exitSpy.mockRestore();
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
