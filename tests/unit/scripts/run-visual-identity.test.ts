import { describe, expect, it } from "vitest";

import { assembleManifest } from "@/scripts/run-visual-identity";
import type { AssetSpec } from "@/lib/sites/visual-identity";
import { VisualIdentityManifestSchema } from "@/types/visual-identity";

const FIXED_DATE = new Date("2026-05-14T01:30:00.000-03:00");

function makeSpec(
  key: AssetSpec["key"],
  manifestField: AssetSpec["manifestField"],
  categoryIndex?: number,
): AssetSpec {
  const isCategory = manifestField === "categories_urls";
  return {
    key,
    size: isCategory ? "1024x1024" : "1536x1024",
    quality: "medium",
    manifestField,
    ...(categoryIndex !== undefined ? { categoryIndex } : {}),
  };
}

describe("assembleManifest", () => {
  it("assembles a complete 9-asset manifest validated by the schema", () => {
    const specs: AssetSpec[] = [
      makeSpec("hero", "hero_url"),
      makeSpec("about", "about_url"),
      makeSpec("contact", "contact_url"),
      makeSpec("category_suv", "categories_urls", 0),
      makeSpec("category_sedan", "categories_urls", 1),
      makeSpec("category_hatch", "categories_urls", 2),
      makeSpec("category_pickup", "categories_urls", 3),
      makeSpec("category_esportivo", "categories_urls", 4),
      makeSpec("category_conversivel", "categories_urls", 5),
    ];

    const manifest = assembleManifest({
      uploads: [
        { variant: "hero", url: "https://cdn.example.com/hero.png" },
        { variant: "about", url: "https://cdn.example.com/about.png" },
        { variant: "contact", url: "https://cdn.example.com/contact.png" },
        { variant: "category_suv", url: "https://cdn.example.com/c-suv.png" },
        { variant: "category_sedan", url: "https://cdn.example.com/c-sedan.png" },
        { variant: "category_hatch", url: "https://cdn.example.com/c-hatch.png" },
        { variant: "category_pickup", url: "https://cdn.example.com/c-pickup.png" },
        { variant: "category_esportivo", url: "https://cdn.example.com/c-esp.png" },
        { variant: "category_conversivel", url: "https://cdn.example.com/c-conv.png" },
      ],
      specs,
      estimate: { usd: 0.44, brl: 2.21 },
      model: "gpt-image-2-2026-04-21",
      generatedAt: FIXED_DATE,
    });

    expect(() => VisualIdentityManifestSchema.parse(manifest)).not.toThrow();
    expect(manifest.hero_url).toBe("https://cdn.example.com/hero.png");
    expect(manifest.about_url).toBe("https://cdn.example.com/about.png");
    expect(manifest.contact_url).toBe("https://cdn.example.com/contact.png");
    expect(manifest.categories_urls).toEqual([
      "https://cdn.example.com/c-suv.png",
      "https://cdn.example.com/c-sedan.png",
      "https://cdn.example.com/c-hatch.png",
      "https://cdn.example.com/c-pickup.png",
      "https://cdn.example.com/c-esp.png",
      "https://cdn.example.com/c-conv.png",
    ]);
    expect(manifest.generated_at).toBe(FIXED_DATE.toISOString());
    expect(manifest.model).toBe("gpt-image-2-2026-04-21");
    expect(manifest.cost_estimate_brl).toBe(2.21);
  });

  it("respects category order from spec.categoryIndex, not upload order", () => {
    const specs: AssetSpec[] = [
      makeSpec("hero", "hero_url"),
      makeSpec("about", "about_url"),
      makeSpec("contact", "contact_url"),
      makeSpec("category_sedan", "categories_urls", 0),
      makeSpec("category_suv", "categories_urls", 1),
    ];

    const manifest = assembleManifest({
      uploads: [
        // intentionally scrambled order
        { variant: "category_suv", url: "https://cdn.example.com/c-suv.png" },
        { variant: "hero", url: "https://cdn.example.com/hero.png" },
        { variant: "about", url: "https://cdn.example.com/about.png" },
        { variant: "category_sedan", url: "https://cdn.example.com/c-sedan.png" },
        { variant: "contact", url: "https://cdn.example.com/contact.png" },
      ],
      specs,
      estimate: { usd: 0.21, brl: 1.05 },
      model: "gpt-image-2-2026-04-21",
      generatedAt: FIXED_DATE,
    });

    expect(manifest.categories_urls).toEqual([
      "https://cdn.example.com/c-sedan.png",
      "https://cdn.example.com/c-suv.png",
    ]);
  });

  it("supports the single-category Sedan-only scenario (Ducarmo case)", () => {
    const specs: AssetSpec[] = [
      makeSpec("hero", "hero_url"),
      makeSpec("about", "about_url"),
      makeSpec("contact", "contact_url"),
      makeSpec("category_sedan", "categories_urls", 0),
    ];

    const manifest = assembleManifest({
      uploads: [
        { variant: "hero", url: "/cdn/hero.png" },
        { variant: "about", url: "/cdn/about.png" },
        { variant: "contact", url: "/cdn/contact.png" },
        { variant: "category_sedan", url: "/cdn/c-sedan.png" },
      ],
      specs,
      estimate: { usd: 0.231, brl: 1.16 },
      model: "gpt-image-2-2026-04-21",
      generatedAt: FIXED_DATE,
    });

    expect(() => VisualIdentityManifestSchema.parse(manifest)).not.toThrow();
    expect(manifest.categories_urls).toHaveLength(1);
    expect(manifest.categories_urls[0]).toBe("/cdn/c-sedan.png");
  });

  it("throws when a required non-category asset is missing", () => {
    const specs: AssetSpec[] = [
      makeSpec("hero", "hero_url"),
      makeSpec("about", "about_url"),
      // no contact spec
      makeSpec("category_sedan", "categories_urls", 0),
    ];

    expect(() =>
      assembleManifest({
        uploads: [
          { variant: "hero", url: "/cdn/hero.png" },
          { variant: "about", url: "/cdn/about.png" },
          { variant: "category_sedan", url: "/cdn/c-sedan.png" },
        ],
        specs,
        estimate: { usd: 0.1, brl: 0.5 },
        model: "gpt-image-2-2026-04-21",
        generatedAt: FIXED_DATE,
      }),
    ).toThrow(/contact/i);
  });

  it("propagates the fallback model when set", () => {
    const specs: AssetSpec[] = [
      makeSpec("hero", "hero_url"),
      makeSpec("about", "about_url"),
      makeSpec("contact", "contact_url"),
      makeSpec("category_sedan", "categories_urls", 0),
    ];

    const manifest = assembleManifest({
      uploads: [
        { variant: "hero", url: "/cdn/hero.png" },
        { variant: "about", url: "/cdn/about.png" },
        { variant: "contact", url: "/cdn/contact.png" },
        { variant: "category_sedan", url: "/cdn/c-sedan.png" },
      ],
      specs,
      estimate: { usd: 0.05, brl: 0.25 },
      model: "gpt-image-1-mini",
      generatedAt: FIXED_DATE,
    });

    expect(manifest.model).toBe("gpt-image-1-mini");
  });
});
