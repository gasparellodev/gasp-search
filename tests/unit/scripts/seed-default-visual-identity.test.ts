import { describe, expect, it } from "vitest";

import {
  buildDefaultManifest,
  buildDestinationPath,
  parseSeedArgs,
  parseSourceFilename,
} from "@/scripts/seed-default-visual-identity";

describe("parseSourceFilename", () => {
  it("extracts variant and ext from timestamped name", () => {
    expect(parseSourceFilename("hero-1778763518761.png")).toEqual({
      variant: "hero",
      ext: "png",
    });
  });

  it("supports multi-segment variants like category_sedan", () => {
    expect(parseSourceFilename("category_sedan-1778763521787.png")).toEqual({
      variant: "category_sedan",
      ext: "png",
    });
  });

  it("supports filenames without timestamp suffix", () => {
    expect(parseSourceFilename("about.png")).toEqual({
      variant: "about",
      ext: "png",
    });
  });

  it("returns null for unknown variants", () => {
    expect(parseSourceFilename("mystery-123.png")).toBeNull();
  });

  it("returns null for files without an extension", () => {
    expect(parseSourceFilename("hero")).toBeNull();
  });

  it("ignores leading folder paths", () => {
    expect(parseSourceFilename("nested/hero-1.png")).toEqual({
      variant: "hero",
      ext: "png",
    });
  });
});

describe("buildDestinationPath", () => {
  it("normalizes category variants to hyphenated form", () => {
    expect(
      buildDestinationPath({ variant: "category_sedan", ext: "png" }),
    ).toBe("_defaults/v1/category-sedan.png");
  });

  it("preserves simple variant names", () => {
    expect(buildDestinationPath({ variant: "hero", ext: "png" })).toBe(
      "_defaults/v1/hero.png",
    );
  });

  it("preserves non-png extensions like webp", () => {
    expect(buildDestinationPath({ variant: "hero", ext: "webp" })).toBe(
      "_defaults/v1/hero.webp",
    );
  });
});

describe("parseSeedArgs", () => {
  it("returns dry-run false by default", () => {
    expect(parseSeedArgs([])).toEqual({ dryRun: false });
  });

  it("detects --dry-run flag", () => {
    expect(parseSeedArgs(["--dry-run"])).toEqual({ dryRun: true });
  });
});

describe("buildDefaultManifest", () => {
  const BASE =
    "https://example.supabase.co/storage/v1/object/public/visual-identity/_defaults/v1";

  it("maps copied files to canonical manifest fields", () => {
    const manifest = buildDefaultManifest(BASE, [
      "_defaults/v1/hero.png",
      "_defaults/v1/about.png",
      "_defaults/v1/contact.png",
      "_defaults/v1/category-sedan.png",
    ]);
    expect(manifest).toEqual({
      hero_url: `${BASE}/hero.png`,
      about_url: `${BASE}/about.png`,
      contact_url: `${BASE}/contact.png`,
      categories_urls: [`${BASE}/category-sedan.png`],
    });
  });

  it("returns null for missing hero/about/contact", () => {
    expect(
      buildDefaultManifest(BASE, ["_defaults/v1/category-sedan.png"]),
    ).toEqual({
      hero_url: null,
      about_url: null,
      contact_url: null,
      categories_urls: [`${BASE}/category-sedan.png`],
    });
  });

  it("orders categories by canonical sequence (sedan, suv, hatch, pickup, esportivo, conversivel)", () => {
    const manifest = buildDefaultManifest(BASE, [
      "_defaults/v1/category-conversivel.png",
      "_defaults/v1/category-sedan.png",
      "_defaults/v1/category-suv.png",
    ]);
    expect(manifest.categories_urls).toEqual([
      `${BASE}/category-sedan.png`,
      `${BASE}/category-suv.png`,
      `${BASE}/category-conversivel.png`,
    ]);
  });
});
