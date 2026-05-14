import { describe, expect, it } from "vitest";

import {
  DEFAULT_VISUAL_IDENTITY,
  resolveVisualIdentity,
} from "@/lib/sites/default-visual-identity";
import { VisualIdentityManifestSchema } from "@/types/visual-identity";

describe("DEFAULT_VISUAL_IDENTITY", () => {
  it("satisfies VisualIdentityManifestSchema", () => {
    const parsed = VisualIdentityManifestSchema.parse(DEFAULT_VISUAL_IDENTITY);
    expect(parsed).toEqual(DEFAULT_VISUAL_IDENTITY);
  });

  it("points hero/about/contact to the _defaults/v1 folder of the visual-identity bucket", () => {
    expect(DEFAULT_VISUAL_IDENTITY.hero_url).toContain(
      "/visual-identity/_defaults/v1/hero.",
    );
    expect(DEFAULT_VISUAL_IDENTITY.about_url).toContain(
      "/visual-identity/_defaults/v1/about.",
    );
    expect(DEFAULT_VISUAL_IDENTITY.contact_url).toContain(
      "/visual-identity/_defaults/v1/contact.",
    );
  });

  it("includes at least one category URL", () => {
    expect(DEFAULT_VISUAL_IDENTITY.categories_urls.length).toBeGreaterThanOrEqual(
      1,
    );
    expect(DEFAULT_VISUAL_IDENTITY.categories_urls[0]).toContain(
      "/visual-identity/_defaults/v1/category-",
    );
  });
});

describe("resolveVisualIdentity", () => {
  const sampleManifest = {
    hero_url: "https://cdn.example.com/site-hero.png",
    about_url: "https://cdn.example.com/site-about.png",
    contact_url: "https://cdn.example.com/site-contact.png",
    categories_urls: ["https://cdn.example.com/site-cat.png"],
    generated_at: "2026-05-14T12:00:00.000Z",
    model: "gpt-image-2-2026-04-21" as const,
    cost_estimate_brl: 2.45,
  };

  it("returns the site's own visual_identity when present", () => {
    expect(resolveVisualIdentity(sampleManifest)).toEqual(sampleManifest);
  });

  it("returns DEFAULT_VISUAL_IDENTITY when visual_identity is null", () => {
    expect(resolveVisualIdentity(null)).toEqual(DEFAULT_VISUAL_IDENTITY);
  });

  it("returns DEFAULT_VISUAL_IDENTITY when visual_identity is undefined", () => {
    expect(resolveVisualIdentity(undefined)).toEqual(DEFAULT_VISUAL_IDENTITY);
  });

  it("preserves identity reference for sites with their own manifest (no mutation)", () => {
    const resolved = resolveVisualIdentity(sampleManifest);
    expect(resolved).toBe(sampleManifest);
  });

  it("returns the same DEFAULT reference across calls when null (cacheable)", () => {
    const a = resolveVisualIdentity(null);
    const b = resolveVisualIdentity(null);
    expect(a).toBe(b);
    expect(a).toBe(DEFAULT_VISUAL_IDENTITY);
  });
});
