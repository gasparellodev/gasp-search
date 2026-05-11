/**
 * Testes do helper `buildSiteMetadata` (issues #165, #199).
 *
 * Cobertura:
 *   - Legacy path (sem `route`): title `${business_name} — ${pageLabel}`,
 *     description slogan ≥40, OG/Twitter, robots noindex (default).
 *   - **v3 (#199 — SEO foundation):**
 *     - `isIndexable(site)` whitelist (status × signed_at).
 *     - `metadataBase` = env.NEXT_PUBLIC_APP_URL.
 *     - `alternates.canonical` absoluto + `pathname` interpolation.
 *     - `alternates.languages` `pt-BR` + `x-default` apontando para canonical.
 *     - robots toggle via `isIndexable(site)` quando `site` provided.
 *     - Backward-compat: `site` ausente → robots noindex.
 *     - City-aware title/description patterns (6 routes × address null/full).
 */
import { describe, expect, it } from "vitest";

import {
  buildSiteMetadata,
  DESCRIPTION_MAX_LENGTH,
  isIndexable,
  type IndexableSite,
  type SiteRoute,
} from "@/lib/sites/metadata";
import { SITE_FIXTURE } from "../../components/sites/site-fixtures";

const APP_URL = "http://localhost:3000";

const baseVars = {
  business_name: SITE_FIXTURE.business_name,
  business_slug: SITE_FIXTURE.business_slug,
  slogan: SITE_FIXTURE.slogan,
  address: SITE_FIXTURE.address,
  brand_assets: SITE_FIXTURE.brand_assets,
};

const indexableSite: IndexableSite = {
  status: "published",
  signed_at: "2026-05-10T00:00:00Z",
};
const noindexSite: IndexableSite = {
  status: "published",
  signed_at: null,
};

// ===========================================================================
// isIndexable — whitelist defensiva
// ===========================================================================

describe("isIndexable", () => {
  it("status='published' + signed_at set → true", () => {
    expect(
      isIndexable({
        status: "published",
        signed_at: "2026-05-10T00:00:00Z",
      }),
    ).toBe(true);
  });

  it("status='sent' + signed_at set → true", () => {
    expect(
      isIndexable({ status: "sent", signed_at: "2026-05-10T00:00:00Z" }),
    ).toBe(true);
  });

  it("status='draft' + signed_at set → false (status excluído)", () => {
    expect(
      isIndexable({ status: "draft", signed_at: "2026-05-10T00:00:00Z" }),
    ).toBe(false);
  });

  it("status='archived' + signed_at set → false (status excluído)", () => {
    expect(
      isIndexable({
        status: "archived",
        signed_at: "2026-05-10T00:00:00Z",
      }),
    ).toBe(false);
  });

  it("status='published' + signed_at null → false (sem contrato assinado)", () => {
    expect(isIndexable({ status: "published", signed_at: null })).toBe(false);
  });

  it("status='sent' + signed_at null → false (sem contrato assinado)", () => {
    expect(isIndexable({ status: "sent", signed_at: null })).toBe(false);
  });

  it("status desconhecido (futuro) → false (whitelist defensiva)", () => {
    expect(
      isIndexable({ status: "weird-new-status", signed_at: "x" }),
    ).toBe(false);
  });
});

// ===========================================================================
// buildSiteMetadata — backward-compat (sem `route`, sem `site`)
// ===========================================================================

describe("buildSiteMetadata — backward-compat (legacy path)", () => {
  it("title legacy: `${business_name} — ${pageLabel}`", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
    });
    expect(meta.title).toBe(`${baseVars.business_name} — Concessionária`);
  });

  it("description slogan ≥40 chars → usa slogan", () => {
    const longSlogan = "Concessionária de seminovos com qualidade total";
    expect(longSlogan.length).toBeGreaterThanOrEqual(40);
    const meta = buildSiteMetadata({
      variables: { ...baseVars, slogan: longSlogan },
      pageLabel: "Concessionária",
    });
    expect(meta.description).toBe(longSlogan);
  });

  it("description slogan <40 chars → fallback", () => {
    const shortSlogan = "Carros bons.";
    const meta = buildSiteMetadata({
      variables: { ...baseVars, slogan: shortSlogan },
      pageLabel: "Concessionária",
    });
    expect(meta.description).toBe(
      `Encontre seu próximo veículo na ${baseVars.business_name}.`,
    );
  });

  it("slogan exatamente 40 chars (boundary inclusive) → usa slogan", () => {
    const slogan40 = "x".repeat(40);
    const meta = buildSiteMetadata({
      variables: { ...baseVars, slogan: slogan40 },
      pageLabel: "X",
    });
    expect(meta.description).toBe(slogan40);
  });

  it("slogan 39 chars (abaixo do boundary) → fallback", () => {
    const slogan39 = "x".repeat(39);
    const meta = buildSiteMetadata({
      variables: { ...baseVars, slogan: slogan39 },
      pageLabel: "X",
    });
    expect(meta.description).toBe(
      `Encontre seu próximo veículo na ${baseVars.business_name}.`,
    );
  });

  it("sem `site` → robots noindex/nofollow (compat)", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
    });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});

// ===========================================================================
// buildSiteMetadata — robots toggle via isIndexable
// ===========================================================================

describe("buildSiteMetadata — robots toggle", () => {
  it("site indexable → robots { index: true, follow: true }", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
      site: indexableSite,
    });
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("site não-indexable (signed_at null) → robots noindex", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
      site: noindexSite,
    });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("site draft → robots noindex", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
      site: { status: "draft", signed_at: "2026-05-10" },
    });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});

// ===========================================================================
// buildSiteMetadata — metadataBase + canonical + hreflang
// ===========================================================================

describe("buildSiteMetadata — metadataBase / canonical / hreflang", () => {
  it("metadataBase = new URL(NEXT_PUBLIC_APP_URL)", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
    });
    expect(meta.metadataBase).toBeInstanceOf(URL);
    expect(meta.metadataBase?.toString()).toBe(`${APP_URL}/`);
  });

  it("canonical absoluto (pathname='/' → sem trailing path)", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
      pathname: "/",
    });
    expect(meta.alternates?.canonical).toBe(
      `${APP_URL}/sites/${baseVars.business_slug}`,
    );
  });

  it("canonical default (sem pathname) === pathname='/'", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
    });
    expect(meta.alternates?.canonical).toBe(
      `${APP_URL}/sites/${baseVars.business_slug}`,
    );
  });

  it("canonical com pathname='/estoque'", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Estoque",
      pathname: "/estoque",
    });
    expect(meta.alternates?.canonical).toBe(
      `${APP_URL}/sites/${baseVars.business_slug}/estoque`,
    );
  });

  it("canonical com pathname dinâmico de detalhe", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Civic 2020",
      pathname: "/estoque/civic-2020",
    });
    expect(meta.alternates?.canonical).toBe(
      `${APP_URL}/sites/${baseVars.business_slug}/estoque/civic-2020`,
    );
  });

  it("languages: pt-BR + x-default apontam para canonical", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Estoque",
      pathname: "/estoque",
    });
    const canonical = meta.alternates?.canonical;
    expect(meta.alternates?.languages).toEqual({
      "pt-BR": canonical,
      "x-default": canonical,
    });
  });
});

// ===========================================================================
// buildSiteMetadata — city-aware title patterns (per route × address null/full)
// ===========================================================================

describe("buildSiteMetadata — city-aware titles (com address)", () => {
  const detailRoute: SiteRoute = {
    kind: "detalhe",
    car: {
      brand: "Honda",
      model: "Civic",
      year: 2020,
      km: 45000,
      price: 89000,
    },
  };

  it("home: '${name} — Loja de Seminovos em ${city}, ${state}'", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Home",
      route: { kind: "home" },
    });
    expect(meta.title).toBe("Touring Cars — Loja de Seminovos em Recife, PE");
  });

  it("estoque: 'Estoque de Seminovos em ${city} — ${name}'", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Estoque",
      route: { kind: "estoque" },
    });
    expect(meta.title).toBe("Estoque de Seminovos em Recife — Touring Cars");
  });

  it("detalhe: '${brand} ${model} ${year} em ${city} — ${name}'", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Civic",
      route: detailRoute,
    });
    expect(meta.title).toBe("Honda Civic 2020 em Recife — Touring Cars");
  });

  it("sobre: 'Sobre ${name} — Loja em ${city}'", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Sobre",
      route: { kind: "sobre" },
    });
    expect(meta.title).toBe("Sobre Touring Cars — Loja em Recife");
  });

  it("contato: 'Contato ${name} — ${city}, ${state}'", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Contato",
      route: { kind: "contato" },
    });
    expect(meta.title).toBe("Contato Touring Cars — Recife, PE");
  });

  it("anunciar: 'Anuncie seu carro em ${city} — ${name}'", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Anunciar",
      route: { kind: "anunciar" },
    });
    expect(meta.title).toBe("Anuncie seu carro em Recife — Touring Cars");
  });
});

describe("buildSiteMetadata — city-aware titles (address null fallback)", () => {
  const noAddressVars = { ...baseVars, address: null };

  it("home fallback: '${name} — Loja de Seminovos'", () => {
    const meta = buildSiteMetadata({
      variables: noAddressVars,
      pageLabel: "Home",
      route: { kind: "home" },
    });
    expect(meta.title).toBe("Touring Cars — Loja de Seminovos");
  });

  it("estoque fallback: 'Estoque de Seminovos — ${name}'", () => {
    const meta = buildSiteMetadata({
      variables: noAddressVars,
      pageLabel: "Estoque",
      route: { kind: "estoque" },
    });
    expect(meta.title).toBe("Estoque de Seminovos — Touring Cars");
  });

  it("detalhe fallback: '${brand} ${model} ${year} — ${name}'", () => {
    const meta = buildSiteMetadata({
      variables: noAddressVars,
      pageLabel: "Detalhe",
      route: {
        kind: "detalhe",
        car: { brand: "Honda", model: "Civic", year: 2020 },
      },
    });
    expect(meta.title).toBe("Honda Civic 2020 — Touring Cars");
  });

  it("sobre fallback: 'Sobre ${name}'", () => {
    const meta = buildSiteMetadata({
      variables: noAddressVars,
      pageLabel: "Sobre",
      route: { kind: "sobre" },
    });
    expect(meta.title).toBe("Sobre Touring Cars");
  });

  it("contato fallback: 'Contato ${name}'", () => {
    const meta = buildSiteMetadata({
      variables: noAddressVars,
      pageLabel: "Contato",
      route: { kind: "contato" },
    });
    expect(meta.title).toBe("Contato Touring Cars");
  });

  it("anunciar fallback: 'Anuncie seu carro — ${name}'", () => {
    const meta = buildSiteMetadata({
      variables: noAddressVars,
      pageLabel: "Anunciar",
      route: { kind: "anunciar" },
    });
    expect(meta.title).toBe("Anuncie seu carro — Touring Cars");
  });
});

// ===========================================================================
// buildSiteMetadata — city-aware descriptions
// ===========================================================================

describe("buildSiteMetadata — city-aware descriptions", () => {
  it("home com address: contém city + nome", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Home",
      route: { kind: "home" },
    });
    expect(meta.description).toContain("Recife");
    expect(meta.description).toContain("PE");
    expect(meta.description).toContain("Touring Cars");
  });

  it("home sem address: usa slogan/fallback puro", () => {
    const meta = buildSiteMetadata({
      variables: { ...baseVars, address: null, slogan: "x".repeat(45) },
      pageLabel: "Home",
      route: { kind: "home" },
    });
    expect(meta.description).toBe("x".repeat(45));
  });

  it("estoque com address: menciona city + nome", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Estoque",
      route: { kind: "estoque" },
    });
    expect(meta.description).toMatch(/Recife/);
    expect(meta.description).toMatch(/Touring Cars/);
  });

  it("detalhe com km/price: inclui ambos no description", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Detalhe",
      route: {
        kind: "detalhe",
        car: {
          brand: "Honda",
          model: "Civic",
          year: 2020,
          km: 45000,
          price: 89000,
        },
      },
    });
    expect(meta.description).toContain("Honda Civic 2020");
    expect(meta.description).toContain("Recife");
    // PT-BR locale: ponto como separador de milhar
    expect(meta.description).toMatch(/45\.000 km/);
    expect(meta.description).toMatch(/R\$ 89\.000/);
  });

  it("detalhe sem km/price: omite partes opcionais sem quebrar", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Detalhe",
      route: {
        kind: "detalhe",
        car: { brand: "Honda", model: "Civic", year: 2020 },
      },
    });
    expect(meta.description).toContain("Honda Civic 2020");
    expect(meta.description).not.toMatch(/km/);
    expect(meta.description).not.toMatch(/R\$/);
  });

  it("sobre/contato/anunciar emitem descriptions diferenciadas", () => {
    const sobre = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "X",
      route: { kind: "sobre" },
    });
    const contato = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "X",
      route: { kind: "contato" },
    });
    const anunciar = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "X",
      route: { kind: "anunciar" },
    });
    expect(sobre.description).toMatch(/história/i);
    expect(contato.description).toMatch(/contato/i);
    expect(anunciar.description).toMatch(/anuncie/i);
  });

  it("description nunca excede DESCRIPTION_MAX_LENGTH (160)", () => {
    // Força description longo via slogan gigante + city.
    const longSlogan = "a".repeat(200);
    const meta = buildSiteMetadata({
      variables: { ...baseVars, slogan: longSlogan },
      pageLabel: "Home",
      route: { kind: "home" },
    });
    expect(meta.description?.length ?? 0).toBeLessThanOrEqual(
      DESCRIPTION_MAX_LENGTH,
    );
  });

  it("sobre/contato/anunciar sem address: fallback sem city", () => {
    const noAddressVars = { ...baseVars, address: null };
    const sobre = buildSiteMetadata({
      variables: noAddressVars,
      pageLabel: "X",
      route: { kind: "sobre" },
    });
    expect(sobre.description).not.toMatch(/Recife/);

    const contato = buildSiteMetadata({
      variables: noAddressVars,
      pageLabel: "X",
      route: { kind: "contato" },
    });
    expect(contato.description).not.toMatch(/Recife/);

    const anunciar = buildSiteMetadata({
      variables: noAddressVars,
      pageLabel: "X",
      route: { kind: "anunciar" },
    });
    expect(anunciar.description).not.toMatch(/Recife/);

    const estoque = buildSiteMetadata({
      variables: noAddressVars,
      pageLabel: "X",
      route: { kind: "estoque" },
    });
    expect(estoque.description).not.toMatch(/Recife/);

    const detalhe = buildSiteMetadata({
      variables: noAddressVars,
      pageLabel: "X",
      route: {
        kind: "detalhe",
        car: { brand: "Honda", model: "Civic", year: 2020 },
      },
    });
    expect(detalhe.description).not.toMatch(/Recife/);
  });
});

// ===========================================================================
// buildSiteMetadata — OG/Twitter (preserva contrato pré-existente)
// ===========================================================================

describe("buildSiteMetadata — openGraph / twitter", () => {
  it("OG images = brand_assets.logo_url", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
    });
    expect(meta.openGraph?.images).toEqual([
      { url: baseVars.brand_assets.logo_url },
    ]);
  });

  it("OG type='website'", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
    });
    expect((meta.openGraph as { type: string }).type).toBe("website");
  });

  it("OG url = canonical (deep linking)", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Estoque",
      pathname: "/estoque",
    });
    expect((meta.openGraph as { url: string }).url).toBe(
      meta.alternates?.canonical,
    );
  });

  it("twitter.card='summary_large_image'", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
    });
    expect((meta.twitter as { card: string }).card).toBe(
      "summary_large_image",
    );
  });

  it("twitter.images = [logo_url]", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Concessionária",
    });
    expect(meta.twitter?.images).toEqual([baseVars.brand_assets.logo_url]);
  });

  it("OG/Twitter title/description batem com top-level", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "Sobre nós",
    });
    expect(meta.openGraph?.title).toBe(meta.title);
    expect(meta.openGraph?.description).toBe(meta.description);
    expect(meta.twitter?.title).toBe(meta.title);
    expect(meta.twitter?.description).toBe(meta.description);
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe("buildSiteMetadata — edge cases", () => {
  it("business_name com caracteres especiais PT-BR não quebra title", () => {
    const meta = buildSiteMetadata({
      variables: { ...baseVars, business_name: "Auto Açaí & Cia" },
      pageLabel: "Concessionária",
      route: { kind: "home" },
    });
    expect(meta.title).toContain("Auto Açaí & Cia");
  });

  it("slogan undefined (campo optional em v2)", () => {
    const { slogan: _slogan, ...varsNoSlogan } = baseVars;
    void _slogan;
    const meta = buildSiteMetadata({
      variables: varsNoSlogan,
      pageLabel: "Concessionária",
    });
    expect(meta.description).toBe(
      `Encontre seu próximo veículo na ${baseVars.business_name}.`,
    );
  });
});

// ===========================================================================
// #213 — Canonical validation across as 6 rotas reais
//
// PO refinement (#213): garante que cada uma das 6 rotas do Site Generator
// (`/`, `/sobre`, `/contato`, `/anunciar`, `/estoque`, `/estoque/[carSlug]`)
// retorna canonical URL absoluto correto + hreflang pt-BR/x-default
// apontando pro mesmo canonical + metadataBase populado.
//
// Cobertura redundante com testes de helper acima — intencional. Mantém
// defense in depth contra regressão do contrato com as `page.tsx`.
// ===========================================================================

describe("buildSiteMetadata — canonical validation per route (#213)", () => {
  const routes: Array<{
    pathname: string;
    expectedTail: string;
    label: string;
  }> = [
    { pathname: "/", expectedTail: "", label: "home" },
    { pathname: "/sobre", expectedTail: "/sobre", label: "sobre" },
    { pathname: "/contato", expectedTail: "/contato", label: "contato" },
    { pathname: "/anunciar", expectedTail: "/anunciar", label: "anunciar" },
    { pathname: "/estoque", expectedTail: "/estoque", label: "estoque" },
    {
      pathname: "/estoque/civic-2020",
      expectedTail: "/estoque/civic-2020",
      label: "estoque-detalhe",
    },
  ];

  for (const route of routes) {
    it(`rota '${route.label}' (${route.pathname}) → canonical absoluto + hreflang`, () => {
      const meta = buildSiteMetadata({
        variables: baseVars,
        pageLabel: route.label,
        pathname: route.pathname,
      });
      const expected = `${APP_URL}/sites/${baseVars.business_slug}${route.expectedTail}`;

      // Canonical absoluto sem query/trailing duplicado.
      expect(meta.alternates?.canonical).toBe(expected);
      // metadataBase populado com APP_URL.
      expect(meta.metadataBase).toBeInstanceOf(URL);
      expect(meta.metadataBase?.toString()).toBe(`${APP_URL}/`);
      // hreflang pt-BR + x-default ambos apontam pro canonical.
      expect(meta.alternates?.languages).toEqual({
        "pt-BR": expected,
        "x-default": expected,
      });
    });
  }

  it("não emite query string nem fragment no canonical", () => {
    const meta = buildSiteMetadata({
      variables: baseVars,
      pageLabel: "estoque",
      pathname: "/estoque",
    });
    const canonical = meta.alternates?.canonical;
    expect(canonical).not.toContain("?");
    expect(canonical).not.toContain("#");
  });
});
