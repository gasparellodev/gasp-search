import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    EVOLUTION_API_URL: "http://localhost:8080",
    EVOLUTION_API_KEY: "k",
  },
}));

const { _resetRateLimit, checkRateLimit } = await import(
  "@/lib/evolution/rate-limit"
);

beforeEach(() => {
  _resetRateLimit();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-08T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("primeira chamada de um user passa", () => {
    expect(checkRateLimit("u1")).toEqual({ ok: true });
  });

  it("segunda chamada dentro do intervalo bloqueia com retryAfterMs", () => {
    checkRateLimit("u1");
    vi.advanceTimersByTime(1000);
    const res = checkRateLimit("u1");
    expect(res).toEqual({ ok: false, retryAfterMs: 2000 });
  });

  it("após o intervalo libera novamente", () => {
    checkRateLimit("u1");
    vi.advanceTimersByTime(3000);
    expect(checkRateLimit("u1")).toEqual({ ok: true });
  });

  it("buckets são por user (u1 e u2 independentes)", () => {
    expect(checkRateLimit("u1")).toEqual({ ok: true });
    expect(checkRateLimit("u2")).toEqual({ ok: true });
    vi.advanceTimersByTime(500);
    const r1 = checkRateLimit("u1");
    const r2 = checkRateLimit("u2");
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
  });

  it("intervalMs custom respeitado", () => {
    checkRateLimit("u1", 500);
    vi.advanceTimersByTime(400);
    expect(checkRateLimit("u1", 500)).toMatchObject({ ok: false });
    vi.advanceTimersByTime(200);
    expect(checkRateLimit("u1", 500)).toEqual({ ok: true });
  });
});
