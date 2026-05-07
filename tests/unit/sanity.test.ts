import { describe, expect, it } from "vitest";

describe("vitest setup", () => {
  it("roda specs em jsdom", () => {
    expect(typeof window).toBe("object");
    expect(typeof document).toBe("object");
  });

  it("alias @ resolve para a raiz", async () => {
    const { cn } = await import("@/lib/utils");
    expect(typeof cn).toBe("function");
  });
});
