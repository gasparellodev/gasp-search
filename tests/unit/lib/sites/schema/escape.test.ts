import { describe, expect, it } from "vitest";
import { escapeJsonLd, safeAbsoluteUrl } from "@/lib/sites/schema";

describe("escapeJsonLd", () => {
  it("escapes </script> sequences to prevent breakout", () => {
    const value = { name: "Foo</script><script>alert(1)</script>" };
    const out = escapeJsonLd(value);
    expect(out).not.toContain("</script>");
    expect(out).toContain("<\\/script>");
  });

  it("preserves valid JSON for parser", () => {
    const value = { name: "Foo" };
    const out = escapeJsonLd(value);
    expect(JSON.parse(out)).toEqual(value);
  });

  it("handles nested objects", () => {
    const value = { a: { b: "</script>" } };
    const out = escapeJsonLd(value);
    expect(out).not.toContain("</script>");
  });
});

describe("safeAbsoluteUrl", () => {
  it("returns absolute URL when given absolute", () => {
    expect(safeAbsoluteUrl("https://x.com/a")).toBe("https://x.com/a");
  });

  it("prefixes with NEXT_PUBLIC_APP_URL when relative", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.test";
    expect(safeAbsoluteUrl("/foo")).toBe("https://app.test/foo");
  });

  it("returns null for invalid input", () => {
    expect(safeAbsoluteUrl("")).toBeNull();
    expect(safeAbsoluteUrl(null as unknown as string)).toBeNull();
  });
});
