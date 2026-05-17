import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/seo/indexnow", () => ({
  notifyIndexNow: vi.fn(() => Promise.resolve()),
}));

import {
  __resetIndexNowQueueForTests,
  enqueueIndexNow,
  flushIndexNowQueue,
} from "@/lib/seo/indexnow-queue";
import { notifyIndexNow } from "@/lib/seo/indexnow";

describe("indexnow-queue", () => {
  beforeEach(() => {
    __resetIndexNowQueueForTests();
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes after 10 URLs accumulate (size trigger)", async () => {
    for (let i = 0; i < 10; i++) {
      enqueueIndexNow(`https://app.test/sites/x/car-${i}`);
    }
    // flush is fire-and-forget (void), drain microtasks
    await vi.runAllTimersAsync();

    expect(notifyIndexNow).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifyIndexNow).mock.calls[0]![0]).toHaveLength(10);
  });

  it("flushes after 10s when fewer than 10 URLs (time trigger)", async () => {
    enqueueIndexNow("https://app.test/sites/x/car-1");
    enqueueIndexNow("https://app.test/sites/x/car-2");

    expect(notifyIndexNow).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(10_000);

    expect(notifyIndexNow).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifyIndexNow).mock.calls[0]![0]).toHaveLength(2);
  });

  it("does not flush before the timeout elapses", async () => {
    enqueueIndexNow("https://app.test/sites/x/car-1");

    await vi.advanceTimersByTimeAsync(9_999);

    expect(notifyIndexNow).not.toHaveBeenCalled();
  });

  it("dedupes URLs in the queue", async () => {
    enqueueIndexNow("https://app.test/sites/x/car-1");
    enqueueIndexNow("https://app.test/sites/x/car-1");
    enqueueIndexNow("https://app.test/sites/x/car-2");

    await flushIndexNowQueue();

    expect(notifyIndexNow).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifyIndexNow).mock.calls[0]![0]).toEqual([
      "https://app.test/sites/x/car-1",
      "https://app.test/sites/x/car-2",
    ]);
  });

  it("noop when queue is empty on flush", async () => {
    await flushIndexNowQueue();

    expect(notifyIndexNow).not.toHaveBeenCalled();
  });

  it("does not throw if notifyIndexNow rejects (best-effort)", async () => {
    vi.mocked(notifyIndexNow).mockRejectedValueOnce(new Error("boom"));

    enqueueIndexNow("https://app.test/sites/x/car-1");

    await expect(flushIndexNowQueue()).resolves.not.toThrow();
  });

  it("clears pending timer on explicit flush", async () => {
    enqueueIndexNow("https://app.test/sites/x/car-1");

    // Explicit flush should drain the queue and cancel the scheduled timer
    await flushIndexNowQueue();

    expect(notifyIndexNow).toHaveBeenCalledTimes(1);

    // Advancing past the original timeout should NOT trigger a second call
    await vi.advanceTimersByTimeAsync(10_000);

    expect(notifyIndexNow).toHaveBeenCalledTimes(1);
  });

  it("resets queue after flush so second batch starts fresh", async () => {
    enqueueIndexNow("https://app.test/sites/x/car-1");
    await flushIndexNowQueue();

    enqueueIndexNow("https://app.test/sites/x/car-2");
    await flushIndexNowQueue();

    expect(notifyIndexNow).toHaveBeenCalledTimes(2);
    expect(vi.mocked(notifyIndexNow).mock.calls[0]![0]).toEqual([
      "https://app.test/sites/x/car-1",
    ]);
    expect(vi.mocked(notifyIndexNow).mock.calls[1]![0]).toEqual([
      "https://app.test/sites/x/car-2",
    ]);
  });
});
