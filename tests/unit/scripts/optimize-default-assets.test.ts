import { describe, expect, it } from "vitest";

import {
  buildOptimizedPath,
  buildSrcsetString,
  parseOptimizeArgs,
} from "@/scripts/optimize-default-assets";

describe("parseOptimizeArgs", () => {
  it("returns dry-run false by default", () => {
    expect(parseOptimizeArgs([])).toEqual({ dryRun: false });
  });

  it("detects --dry-run flag", () => {
    expect(parseOptimizeArgs(["--dry-run"])).toEqual({ dryRun: true });
  });
});

describe("buildOptimizedPath", () => {
  it("strips PNG extension and appends width + variant", () => {
    expect(buildOptimizedPath("hero.png", 1280, "avif")).toBe(
      "_defaults/v1/hero-1280.avif",
    );
  });

  it("works for multi-segment names (category-sedan)", () => {
    expect(buildOptimizedPath("category-sedan.png", 640, "webp")).toBe(
      "_defaults/v1/category-sedan-640.webp",
    );
  });

  it("handles uppercase extensions", () => {
    expect(buildOptimizedPath("hero.PNG", 1920, "avif")).toBe(
      "_defaults/v1/hero-1920.avif",
    );
  });
});

describe("buildSrcsetString", () => {
  const BASE =
    "https://example.supabase.co/storage/v1/object/public/visual-identity/_defaults/v1";

  it("produces srcset for 3 widths (avif)", () => {
    expect(buildSrcsetString(BASE, "hero", "avif")).toBe(
      [
        `${BASE}/hero-640.avif 640w`,
        `${BASE}/hero-1280.avif 1280w`,
        `${BASE}/hero-1920.avif 1920w`,
      ].join(", "),
    );
  });

  it("produces srcset for webp", () => {
    expect(buildSrcsetString(BASE, "about", "webp")).toContain(
      "/about-640.webp 640w",
    );
    expect(buildSrcsetString(BASE, "about", "webp")).toContain(
      "/about-1920.webp 1920w",
    );
  });

  it("trims trailing slash from baseUrl", () => {
    const withSlash = `${BASE}/`;
    expect(buildSrcsetString(withSlash, "hero", "avif")).not.toContain("//hero");
  });
});
