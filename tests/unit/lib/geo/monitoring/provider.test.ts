import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// server-only is stubbed via vitest.config.ts alias — no need to mock here

describe("MockMonitoringProvider", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns cited=false", async () => {
    const { MockMonitoringProvider } = await import(
      "@/lib/geo/monitoring/provider"
    );
    const provider = new MockMonitoringProvider();
    const result = await provider.check("minha query", "example.com");
    expect(result.cited).toBe(false);
  });

  it("returns source='mock'", async () => {
    const { MockMonitoringProvider } = await import(
      "@/lib/geo/monitoring/provider"
    );
    const provider = new MockMonitoringProvider();
    const result = await provider.check("test", "example.com");
    expect(result.source).toBe("mock");
  });

  it("returns snippet=null", async () => {
    const { MockMonitoringProvider } = await import(
      "@/lib/geo/monitoring/provider"
    );
    const provider = new MockMonitoringProvider();
    const result = await provider.check("test", "example.com");
    expect(result.snippet).toBeNull();
  });

  it("echoes the query back in the result", async () => {
    const { MockMonitoringProvider } = await import(
      "@/lib/geo/monitoring/provider"
    );
    const provider = new MockMonitoringProvider();
    const query = "Toyota seminovos em Campinas";
    const result = await provider.check(query, "gasplab.com.br/sites/abc");
    expect(result.query).toBe(query);
  });

  it("returns a valid Date for checked_at", async () => {
    const { MockMonitoringProvider } = await import(
      "@/lib/geo/monitoring/provider"
    );
    const provider = new MockMonitoringProvider();
    const before = new Date();
    const result = await provider.check("test", "example.com");
    const after = new Date();
    expect(result.checked_at).toBeInstanceOf(Date);
    expect(result.checked_at.getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    );
    expect(result.checked_at.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("exposes source='mock' on the instance", async () => {
    const { MockMonitoringProvider } = await import(
      "@/lib/geo/monitoring/provider"
    );
    const provider = new MockMonitoringProvider();
    expect(provider.source).toBe("mock");
  });

  it("emits a console.warn on every call", async () => {
    const { MockMonitoringProvider } = await import(
      "@/lib/geo/monitoring/provider"
    );
    const provider = new MockMonitoringProvider();
    await provider.check("q1", "d1");
    await provider.check("q2", "d2");
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("MockMonitoringProvider");
  });
});
