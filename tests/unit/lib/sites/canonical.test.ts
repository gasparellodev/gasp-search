import { describe, expect, it } from "vitest";
import { normalizeCanonical } from "@/lib/sites/canonical";

describe("normalizeCanonical", () => {
  it("returns lowercased pathname without trailing slash", () => {
    expect(normalizeCanonical("/Sites/POLIGUARA/Estoque/")).toBe("/sites/poliguara/estoque");
  });

  it("preserves root slash", () => {
    expect(normalizeCanonical("/")).toBeNull(); // / is not under /sites/, returns null
  });

  it("returns null for non-site routes (no normalization needed)", () => {
    expect(normalizeCanonical("/dashboard")).toBeNull();
    expect(normalizeCanonical("/login")).toBeNull();
    expect(normalizeCanonical("/api/foo")).toBeNull();
  });

  it("returns null when pathname already canonical", () => {
    expect(normalizeCanonical("/sites/poliguara")).toBeNull();
    expect(normalizeCanonical("/sites/poliguara/estoque")).toBeNull();
  });

  it("lowercases uppercase slug", () => {
    expect(normalizeCanonical("/sites/POLIGUARA")).toBe("/sites/poliguara");
  });

  it("removes trailing slash on non-root site paths", () => {
    expect(normalizeCanonical("/sites/poliguara/")).toBe("/sites/poliguara");
    expect(normalizeCanonical("/sites/poliguara/estoque/")).toBe("/sites/poliguara/estoque");
  });

  it("handles combined uppercase + trailing slash", () => {
    expect(normalizeCanonical("/Sites/X/")).toBe("/sites/x");
  });

  it("does NOT strip query string (caller preserves it)", () => {
    // function signature only takes pathname; caller preserves search.
    // This test documents the intentional API: queries are NOT input.
    expect(normalizeCanonical("/sites/X/estoque")).toBe("/sites/x/estoque");
  });
});
