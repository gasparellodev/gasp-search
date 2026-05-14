import { describe, expect, it } from "vitest";

import { getOptimizedSourcesForDefault } from "@/lib/sites/default-visual-identity";

describe("getOptimizedSourcesForDefault", () => {
  it("returns null for non-default URLs", () => {
    expect(
      getOptimizedSourcesForDefault("https://cdn.other.com/hero.png"),
    ).toBeNull();
  });

  it("returns null for null/undefined/empty", () => {
    expect(getOptimizedSourcesForDefault(null)).toBeNull();
    expect(getOptimizedSourcesForDefault(undefined)).toBeNull();
    expect(getOptimizedSourcesForDefault("")).toBeNull();
  });

  it("matches default hero URL and emits AVIF + WebP srcsets across 3 widths", () => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/visual-identity/_defaults/v1/hero.png`;
    const sources = getOptimizedSourcesForDefault(url);
    expect(sources).not.toBeNull();
    expect(sources!.avifSrcset).toContain("hero-640.avif 640w");
    expect(sources!.avifSrcset).toContain("hero-1280.avif 1280w");
    expect(sources!.avifSrcset).toContain("hero-1920.avif 1920w");
    expect(sources!.webpSrcset).toContain("hero-640.webp 640w");
    expect(sources!.webpSrcset).toContain("hero-1920.webp 1920w");
    expect(sources!.fallbackPngUrl).toBe(url);
  });

  it("matches default about URL", () => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/visual-identity/_defaults/v1/about.png`;
    const sources = getOptimizedSourcesForDefault(url);
    expect(sources).not.toBeNull();
    expect(sources!.avifSrcset).toContain("about-1280.avif");
  });

  it("matches default contact URL", () => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/visual-identity/_defaults/v1/contact.png`;
    expect(getOptimizedSourcesForDefault(url)).not.toBeNull();
  });

  it("does NOT match category-sedan (only hero/about/contact otimizados em WP8)", () => {
    // category-sedan tem variants AVIF/WebP geradas pelo script, mas o helper
    // só dispara <picture> em hero/about/contact que aparecem no fold inicial.
    // CategoriesCars usa `<Image>` legado dentro de cards 4:3 sem LCP impact.
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/visual-identity/_defaults/v1/category-sedan.png`;
    expect(getOptimizedSourcesForDefault(url)).toBeNull();
  });
});
