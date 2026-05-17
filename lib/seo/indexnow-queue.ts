import "server-only";

import { notifyIndexNow } from "./indexnow";

/**
 * Batched IndexNow queue (#367).
 *
 * Coalesces multiple rapid mutations (e.g., batch car upload) into 1-2
 * IndexNow POSTs instead of N. Auto-flushes after:
 *   - `FLUSH_SIZE` unique URLs accumulate (size trigger), OR
 *   - `FLUSH_TIMEOUT_MS` since the first enqueue without a flush (time trigger)
 *
 * Best-effort: flush errors are swallowed with `console.warn` so they never
 * block the caller's success path.
 *
 * NOTE: this module uses module-level singleton state. In the Next.js
 * serverless model each warm lambda instance has its own queue, which is
 * acceptable — worst case two lambdas send two slightly-overlapping batches.
 * For production multi-instance dedup, a Redis-backed queue would be
 * required (V2 scope).
 */

const FLUSH_TIMEOUT_MS = 10_000;
const FLUSH_SIZE = 10;

let queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Reset internal state. For tests only — do not call in production code.
 */
export function __resetIndexNowQueueForTests(): void {
  queue = new Set();
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/**
 * Add `url` to the pending IndexNow queue.
 *
 * - If the queue reaches `FLUSH_SIZE` URLs, flushes immediately (fire-and-forget).
 * - Otherwise, schedules a flush after `FLUSH_TIMEOUT_MS` if one isn't already pending.
 * - Duplicate URLs within the same queue window are coalesced (Set semantics).
 */
export function enqueueIndexNow(url: string): void {
  queue.add(url);

  if (queue.size >= FLUSH_SIZE) {
    // Flush synchronously (fire-and-forget) so the caller isn't blocked.
    void flushIndexNowQueue();
    return;
  }

  if (!timer) {
    timer = setTimeout(() => {
      void flushIndexNowQueue();
    }, FLUSH_TIMEOUT_MS);
  }
}

/**
 * Immediately flush all queued URLs to IndexNow.
 *
 * Safe to call even when the queue is empty (no-op).
 * Errors from `notifyIndexNow` are caught and logged — never re-thrown.
 */
export async function flushIndexNowQueue(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  if (queue.size === 0) return;

  const urls = Array.from(queue);
  queue = new Set();

  try {
    await notifyIndexNow(urls);
  } catch (err) {
    console.warn("indexnow-queue:flush_failed", {
      urlCount: urls.length,
      errorName: err instanceof Error ? err.name : "unknown",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}
