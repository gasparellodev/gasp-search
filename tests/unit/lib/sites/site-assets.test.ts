import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SITE_ASSETS, resolveHeroImageUrl } from "@/lib/sites/site-assets";

describe("SITE_ASSETS", () => {
  it("expõe paths absolutos sob /assets/", () => {
    expect(SITE_ASSETS.hero.texture).toMatch(/^\/assets\//);
    expect(SITE_ASSETS.hero.demoCarCutout).toMatch(/^\/assets\//);
    expect(SITE_ASSETS.emphasis.demoImage).toMatch(/^\/assets\//);
    expect(SITE_ASSETS.recentSales.demoImage).toMatch(/^\/assets\//);
  });

  it("usa o Porsche como demo cutout default (Figma-fiel decisão final 2026-05-09)", () => {
    expect(SITE_ASSETS.hero.demoCarCutout).toBe("/assets/hero/porsche-model1.png");
  });

  it("usa texturatc como textura grain do hero", () => {
    expect(SITE_ASSETS.hero.texture).toBe("/assets/hero/texturatc.png");
  });

  it("texture aponta pra arquivo que existe em public/", () => {
    // a textura é decorativa fixa — exige presença física no repo
    const file = path.join(
      process.cwd(),
      "public",
      SITE_ASSETS.hero.texture,
    );
    expect(existsSync(file)).toBe(true);
  });
});

describe("resolveHeroImageUrl()", () => {
  it("retorna a URL fornecida quando truthy", () => {
    expect(resolveHeroImageUrl("/assets/hero/poliguara-pulse.png")).toBe(
      "/assets/hero/poliguara-pulse.png",
    );
    expect(resolveHeroImageUrl("https://cdn.example.com/foo.png")).toBe(
      "https://cdn.example.com/foo.png",
    );
  });

  it("cai no demoCarCutout quando undefined", () => {
    expect(resolveHeroImageUrl(undefined)).toBe(SITE_ASSETS.hero.demoCarCutout);
  });

  it("cai no demoCarCutout quando null", () => {
    expect(resolveHeroImageUrl(null)).toBe(SITE_ASSETS.hero.demoCarCutout);
  });

  it("cai no demoCarCutout quando string vazia", () => {
    expect(resolveHeroImageUrl("")).toBe(SITE_ASSETS.hero.demoCarCutout);
  });
});
