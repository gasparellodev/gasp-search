/**
 * Testes do `<AICitableHero>` (issue #214 / Sprint 1 / #S4).
 *
 * Server Component que renderiza um `<p>` factual passage-citable para
 * AI crawlers — usado em Home, Estoque (lista) e Detalhe.
 *
 * Decisões PO refinement (#214):
 *   - Frase factual sem "loja online" — evita expectativa de e-commerce.
 *   - Hedging "consulte estoque atualizado" NÃO entra na frase principal
 *     (só no rodapé do llms.txt).
 *   - SEMPRE visível mobile (não `sr-only`) — AI crawlers são mobile-first.
 *   - Prop `page: 'home' | 'estoque' | 'detalhe'` controla a frase.
 *   - Address null → fallback "no Brasil" (não omitir).
 *   - cars.length === 0 → omitir cláusula cars/minPrice (frase reduzida).
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AICitableHero } from "@/components/sites/AICitableHero";
import type { SiteVariablesV2 } from "@/types/lead-site";

import { SITE_FIXTURE } from "./site-fixtures";

const baseVars: Pick<
  SiteVariablesV2,
  "business_name" | "address" | "cars" | "phone_display"
> = {
  business_name: SITE_FIXTURE.business_name,
  address: SITE_FIXTURE.address,
  cars: SITE_FIXTURE.cars,
  phone_display: SITE_FIXTURE.phone_display,
};

describe("AICitableHero — page=home", () => {
  it("renderiza wrapper factual com business_name + city/state + cars.length", () => {
    const { container } = render(<AICitableHero variables={baseVars} page="home" />);
    const wrapper = screen.getByTestId("ai-citable-hero");
    // #G4: data-testid agora está no <div> wrapper (contém <p> factual + <address> microdata)
    expect(wrapper.tagName).toBe("DIV");

    // O <p> factual está dentro do wrapper
    const p = container.querySelector("p");
    expect(p).not.toBeNull();

    const text = wrapper.textContent ?? "";
    expect(text).toContain(SITE_FIXTURE.business_name);
    expect(text).toContain("Recife/PE");
    expect(text).toContain(String(SITE_FIXTURE.cars.length));
    expect(text).toContain("carros em estoque");
  });

  it("inclui min price quando há cars com price > 0", () => {
    render(<AICitableHero variables={baseVars} page="home" />);
    const text = screen.getByTestId("ai-citable-hero").textContent ?? "";
    expect(text).toMatch(/a partir de R\$\s?\d/);
  });

  it("fallback 'no Brasil' quando address === null", () => {
    render(
      <AICitableHero
        variables={{ ...baseVars, address: null }}
        page="home"
      />,
    );
    const text = screen.getByTestId("ai-citable-hero").textContent ?? "";
    expect(text).toContain("no Brasil");
    expect(text).not.toContain("Recife/PE");
  });

  it("omite cláusula 'carros em estoque' quando cars.length === 0", () => {
    render(
      <AICitableHero
        variables={{ ...baseVars, cars: [] }}
        page="home"
      />,
    );
    const text = screen.getByTestId("ai-citable-hero").textContent ?? "";
    expect(text).not.toContain("carros em estoque");
    expect(text).not.toMatch(/a partir de R\$/);
    // Mas frase base ainda emite contexto
    expect(text).toContain(SITE_FIXTURE.business_name);
  });

  it("NÃO usa sr-only (sempre visível mobile)", () => {
    render(<AICitableHero variables={baseVars} page="home" />);
    const p = screen.getByTestId("ai-citable-hero");
    expect(p.className).not.toContain("sr-only");
  });
});

describe("AICitableHero — page=estoque", () => {
  it("frase contextualizada para listagem de estoque", () => {
    render(<AICitableHero variables={baseVars} page="estoque" />);
    const text = screen.getByTestId("ai-citable-hero").textContent ?? "";
    expect(text).toContain("Estoque atualizado de");
    expect(text).toContain(SITE_FIXTURE.business_name);
    expect(text).toContain("Recife/PE");
    expect(text).toContain("carros seminovos disponíveis");
  });

  it("address null → omite localização sem quebrar frase", () => {
    render(
      <AICitableHero
        variables={{ ...baseVars, address: null }}
        page="estoque"
      />,
    );
    const text = screen.getByTestId("ai-citable-hero").textContent ?? "";
    expect(text).toContain(SITE_FIXTURE.business_name);
    expect(text).not.toContain("Recife/PE");
  });
});

describe("AICitableHero — page=detalhe", () => {
  const currentCar = {
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
  };

  it("frase contextualizada com brand model year do car atual", () => {
    render(
      <AICitableHero
        variables={baseVars}
        page="detalhe"
        currentCar={currentCar}
      />,
    );
    const text = screen.getByTestId("ai-citable-hero").textContent ?? "";
    expect(text).toContain("Toyota Corolla 2020");
    expect(text).toContain(SITE_FIXTURE.business_name);
    expect(text).toContain("Recife/PE");
  });

  it("address null → menciona business_name sem cidade", () => {
    render(
      <AICitableHero
        variables={{ ...baseVars, address: null }}
        page="detalhe"
        currentCar={currentCar}
      />,
    );
    const text = screen.getByTestId("ai-citable-hero").textContent ?? "";
    expect(text).toContain("Toyota Corolla 2020");
    expect(text).toContain(SITE_FIXTURE.business_name);
    expect(text).not.toContain("Recife/PE");
  });

  it("sem currentCar (caller esquece prop) — não crasha, omite cláusula", () => {
    render(<AICitableHero variables={baseVars} page="detalhe" />);
    const text = screen.getByTestId("ai-citable-hero").textContent ?? "";
    // Frase ainda emite contexto mesmo sem currentCar (gracefully)
    expect(text).toContain(SITE_FIXTURE.business_name);
  });
});

describe("AICitableHero — sanity defensivo", () => {
  it("não emite 'undefined' nem '[object Object]' no DOM", () => {
    render(<AICitableHero variables={baseVars} page="home" />);
    const text = screen.getByTestId("ai-citable-hero").textContent ?? "";
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("[object Object]");
  });

  it("classe muted-foreground + text-sm (tipografia discreta visível)", () => {
    const { container } = render(<AICitableHero variables={baseVars} page="home" />);
    // #G4: classes estão no <p> interno, não no <div> wrapper
    const p = container.querySelector("p");
    expect(p).not.toBeNull();
    expect(p!.className).toMatch(/text-muted-foreground|text-foreground/);
    expect(p!.className).toContain("text-sm");
  });
});

// ---------------------------------------------------------------------------
// #G4 — Microdata: <address> + itemprop attributes
// ---------------------------------------------------------------------------

describe("AICitableHero — microdata <address> (page=home)", () => {
  it("emits semantic <address> element with aria-label when address present", () => {
    const { container } = render(
      <AICitableHero variables={baseVars} page="home" />,
    );
    const addr = container.querySelector(
      'address[aria-label="Informações de contato da concessionária"]',
    );
    expect(addr).not.toBeNull();
  });

  it("includes itemscope + itemtype Microdata attributes on contact wrapper", () => {
    const { container } = render(
      <AICitableHero variables={baseVars} page="home" />,
    );
    const wrapper = container.querySelector(
      '[itemscope][itemtype="https://schema.org/LocalBusiness"]',
    );
    expect(wrapper).not.toBeNull();
  });

  it("includes itemprop='name' span with business_name", () => {
    const { container } = render(
      <AICitableHero variables={baseVars} page="home" />,
    );
    const nameSpan = container.querySelector("[itemprop='name']");
    expect(nameSpan).not.toBeNull();
    expect(nameSpan?.textContent).toContain(SITE_FIXTURE.business_name);
  });

  it("includes itemprop='telephone' on phone span when phone present", () => {
    const { container } = render(
      <AICitableHero variables={baseVars} page="home" />,
    );
    const phoneSpan = container.querySelector("[itemprop='telephone']");
    expect(phoneSpan).not.toBeNull();
    expect(phoneSpan?.textContent).toContain(SITE_FIXTURE.phone_display);
  });

  it("includes itemprop nested PostalAddress when address present", () => {
    const { container } = render(
      <AICitableHero variables={baseVars} page="home" />,
    );
    const addrSpan = container.querySelector(
      "[itemprop='address'][itemscope][itemtype='https://schema.org/PostalAddress']",
    );
    expect(addrSpan).not.toBeNull();
    expect(
      addrSpan?.querySelector("[itemprop='streetAddress']"),
    ).not.toBeNull();
    expect(
      addrSpan?.querySelector("[itemprop='addressLocality']"),
    ).not.toBeNull();
    expect(
      addrSpan?.querySelector("[itemprop='addressRegion']"),
    ).not.toBeNull();
    expect(
      addrSpan?.querySelector("[itemprop='postalCode']"),
    ).not.toBeNull();
  });

  it("does NOT emit <address> when no contact data present (graceful)", () => {
    const { container } = render(
      <AICitableHero
        variables={{ ...baseVars, address: null }}
        page="home"
      />,
    );
    const addr = container.querySelector("address");
    expect(addr).toBeNull();
  });

  it("preserves data-testid='ai-citable-hero' for backward compat", () => {
    render(<AICitableHero variables={baseVars} page="home" />);
    const p = screen.getByTestId("ai-citable-hero");
    expect(p).not.toBeNull();
  });
});
