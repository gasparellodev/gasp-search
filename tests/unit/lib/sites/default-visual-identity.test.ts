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

  it("returns DEFAULT field values when no visual_identity nor brand_assets", () => {
    const a = resolveVisualIdentity(null);
    const b = resolveVisualIdentity(null);
    expect(a).toEqual(b);
    // Per-field fallback (WP4 fix 2026-05-14): cada call constrói novo
    // objeto via spread pra suportar merge com brand_assets opcional. Não
    // é mais singleton, mas valores são determinísticos.
    expect(a.hero_url).toBe(DEFAULT_VISUAL_IDENTITY.hero_url);
    expect(a.about_url).toBe(DEFAULT_VISUAL_IDENTITY.about_url);
    expect(a.contact_url).toBe(DEFAULT_VISUAL_IDENTITY.contact_url);
  });

  it("usa brand_assets.hero_image_url quando visual_identity é null (WP4 fix)", () => {
    const resolved = resolveVisualIdentity(null, {
      hero_image_url: "https://cdn.example.com/custom-hero.png",
      about_image_url: "https://cdn.example.com/custom-about.png",
      contact_image_url: "https://cdn.example.com/custom-contact.png",
    });
    expect(resolved.hero_url).toBe("https://cdn.example.com/custom-hero.png");
    expect(resolved.about_url).toBe("https://cdn.example.com/custom-about.png");
    expect(resolved.contact_url).toBe(
      "https://cdn.example.com/custom-contact.png",
    );
  });

  it("ignora URLs placeholder (placehold.co) e cai pro default", () => {
    const resolved = resolveVisualIdentity(null, {
      hero_image_url: "https://placehold.co/1024x768/0c0c0c/ffffff.png",
      about_image_url: "",
      contact_image_url: null as never,
    });
    expect(resolved.hero_url).toBe(DEFAULT_VISUAL_IDENTITY.hero_url);
    expect(resolved.about_url).toBe(DEFAULT_VISUAL_IDENTITY.about_url);
    expect(resolved.contact_url).toBe(DEFAULT_VISUAL_IDENTITY.contact_url);
  });

  it("visual_identity sempre precede brand_assets", () => {
    const vi = {
      hero_url: "https://vi.example.com/h.png",
      about_url: "https://vi.example.com/a.png",
      contact_url: "https://vi.example.com/c.png",
      categories_urls: ["https://vi.example.com/cat.png"],
      generated_at: "2026-01-01T00:00:00.000Z",
      model: "gpt-image-2-2026-04-21" as const,
      cost_estimate_brl: 2.45,
    };
    const resolved = resolveVisualIdentity(vi, {
      hero_image_url: "https://brand.example.com/h.png",
      about_image_url: "https://brand.example.com/a.png",
      contact_image_url: "https://brand.example.com/c.png",
    });
    expect(resolved.hero_url).toBe(vi.hero_url);
    expect(resolved.about_url).toBe(vi.about_url);
  });
});
