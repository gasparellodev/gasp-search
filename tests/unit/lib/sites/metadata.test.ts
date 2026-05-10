/**
 * Testes do helper `buildSiteMetadata` (issue #165).
 *
 * Cobertura per AC1 + AC4:
 *   - Title format `${business_name} — ${pageLabel}`.
 *   - Description: slogan ≥40 chars → slogan; senão → fallback.
 *   - OG image: `variables.logo_url`.
 *   - Twitter card: `summary_large_image`.
 *   - robots: `{ index: false, follow: false }` (sempre preservado).
 *   - openGraph + twitter completos (title, description, images).
 */
import { describe, expect, it } from "vitest";

import { buildSiteMetadata } from "@/lib/sites/metadata";
import { SITE_FIXTURE } from "../../components/sites/site-fixtures";

const baseVars = {
  business_name: SITE_FIXTURE.business_name,
  slogan: SITE_FIXTURE.slogan,
  logo_url: SITE_FIXTURE.brand_assets.logo_url,
};

describe("buildSiteMetadata — title", () => {
  it("formata title como `${business_name} — ${pageLabel}`", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
    });
    expect(meta.title).toBe(`${baseVars.business_name} — Concessionária`);
  });

  it("respeita pageLabel customizado (ex: detalhe de carro)", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Toyota Corolla 2022",
    });
    expect(meta.title).toBe(`${baseVars.business_name} — Toyota Corolla 2022`);
  });
});

describe("buildSiteMetadata — description", () => {
  it("slogan ≥40 chars → usa slogan diretamente", () => {
    const longSlogan = "Concessionária de seminovos com qualidade total";
    expect(longSlogan.length).toBeGreaterThanOrEqual(40);
    const meta = buildSiteMetadata({
      variables: { ...baseVars, slogan: longSlogan },
      pageLabel: "Concessionária",
    });
    expect(meta.description).toBe(longSlogan);
  });

  it("slogan <40 chars → usa fallback `Encontre seu próximo veículo na ${business_name}.`", () => {
    const shortSlogan = "Carros bons.";
    expect(shortSlogan.length).toBeLessThan(40);
    const meta = buildSiteMetadata({
      variables: { ...baseVars, slogan: shortSlogan },
      pageLabel: "Concessionária",
    });
    expect(meta.description).toBe(
      `Encontre seu próximo veículo na ${baseVars.business_name}.`,
    );
  });

  it("slogan exatamente 40 chars → usa slogan (boundary)", () => {
    const slogan40 = "x".repeat(40);
    const meta = buildSiteMetadata({
      variables: { ...baseVars, slogan: slogan40 },
      pageLabel: "Concessionária",
    });
    expect(meta.description).toBe(slogan40);
  });

  it("slogan 39 chars → usa fallback (boundary)", () => {
    const slogan39 = "x".repeat(39);
    const meta = buildSiteMetadata({
      variables: { ...baseVars, slogan: slogan39 },
      pageLabel: "Concessionária",
    });
    expect(meta.description).toBe(
      `Encontre seu próximo veículo na ${baseVars.business_name}.`,
    );
  });
});

describe("buildSiteMetadata — robots", () => {
  it("sempre retorna `robots: { index: false, follow: false }`", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
    });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});

describe("buildSiteMetadata — openGraph", () => {
  it("openGraph.images contém { url: variables.logo_url }", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
    });
    expect(meta.openGraph?.images).toEqual([{ url: baseVars.logo_url }]);
  });

  it("openGraph.title bate com title", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Sobre nós",
    });
    expect(meta.openGraph?.title).toBe(`${baseVars.business_name} — Sobre nós`);
  });

  it("openGraph.type='website'", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
    });
    expect((meta.openGraph as { type: string }).type).toBe("website");
  });

  it("openGraph.description usa mesma description", () => {
    const longSlogan = "Concessionária de seminovos com qualidade total";
    const meta = buildSiteMetadata({
      variables: { ...baseVars, slogan: longSlogan },
      pageLabel: "Concessionária",
    });
    expect(meta.openGraph?.description).toBe(longSlogan);
  });
});

describe("buildSiteMetadata — twitter", () => {
  it("twitter.card='summary_large_image'", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
    });
    expect((meta.twitter as { card: string }).card).toBe("summary_large_image");
  });

  it("twitter.images = [variables.logo_url]", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
    });
    expect(meta.twitter?.images).toEqual([baseVars.logo_url]);
  });

  it("twitter.title bate com title", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Contato",
    });
    expect(meta.twitter?.title).toBe(`${baseVars.business_name} — Contato`);
  });
});
