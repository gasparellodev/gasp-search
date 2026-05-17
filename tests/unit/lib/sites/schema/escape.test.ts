import { describe, expect, it } from "vitest";
import { escapeJsonLd, safeAbsoluteUrl } from "@/lib/sites/schema";

describe("escapeJsonLd", () => {
  it("escapes </script> sequences to prevent breakout", () => {
    const value = { name: "Foo</script><script>alert(1)</script>" };
    const out = escapeJsonLd(value);
    expect(out).not.toContain("</script>");
    // Unicode escapes — valid JSON, XSS-safe
    expect(out).toContain("\\u003c");
    expect(out).toContain("\\u003e");
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

  it("escapes HTML comment sequences", () => {
    const out = escapeJsonLd({ a: "<!-- foo -->", b: "price --> tax" });
    expect(out).not.toContain("<!--");
    expect(out).not.toContain("-->");
    expect(JSON.parse(out)).toEqual({ a: "<!-- foo -->", b: "price --> tax" });
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

  it("returns null for javascript: and data: schemes", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.test";
    expect(safeAbsoluteUrl("javascript:alert(1)")).toBeNull();
    expect(safeAbsoluteUrl("data:text/html,xss")).toBeNull();
  });
});
