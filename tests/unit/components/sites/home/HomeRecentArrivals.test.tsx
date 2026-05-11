/**
 * Testes do <HomeRecentArrivals /> (issue #222 / Sprint 4 / H2).
 *
 * Substitui o legacy `<HomeRecentSales>`. Consome `variables.cars`
 * (até 8 cards `<CarCard>`). `recent_sales` do schema só tem 3 entries
 * com `{car_name, image_url}` — não casa a anatomia full `<CarCard>`.
 * Por isso o componente usa `cars.slice(0, 8)` (PO decision via spec
 * ambiguity resolution).
 *
 * **Empty state**: `cars.length === 0` → trust signals + WhatsApp CTA
 * (generic template). Schema garante min 4 hoje, mas o componente
 * defende o caso futuro / runtime (lead com payload mutilado).
 */
import { render, screen, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { HomeRecentArrivals } from "@/components/sites/home/HomeRecentArrivals";

import { SITE_FIXTURE } from "../site-fixtures";

expect.extend(toHaveNoViolations);

const SLUG = "j7k2p9-touring-cars";
const PHONE = "5511987654321";
const BUSINESS = "Touring Cars";

describe("<HomeRecentArrivals />", () => {
  it("renderiza header <h2> 'Recém-chegados'", () => {
    render(
      <HomeRecentArrivals
        cars={SITE_FIXTURE.cars}
        siteSlug={SLUG}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: /recém-chegados/i }),
    ).toBeInTheDocument();
  });

  it("renderiza um <CarCard> por carro até o limite de 8", () => {
    render(
      <HomeRecentArrivals
        cars={SITE_FIXTURE.cars}
        siteSlug={SLUG}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
      />,
    );
    // Fixture tem 4 carros — espera 4 CarCards.
    for (const car of SITE_FIXTURE.cars) {
      expect(screen.getByTestId(`car-card-${car.slug}`)).toBeInTheDocument();
    }
  });

  it("limita render a 8 cards mesmo quando `cars.length > 8`", () => {
    // Constrói 10 carros (clones com slug único pra unicidade do test).
    const base = SITE_FIXTURE.cars[0];
    if (!base) throw new Error("fixture vazia");
    const many = Array.from({ length: 10 }, (_, i) => ({
      ...base,
      slug: `car-clone-${i}`,
    }));
    render(
      <HomeRecentArrivals
        cars={many}
        siteSlug={SLUG}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
      />,
    );
    // Conta apenas o container `<article>` outer de cada CarCard (testid sem sufixo).
    const cards = screen.getAllByTestId(/^car-card-car-clone-\d+$/);
    expect(cards).toHaveLength(8);
  });

  it("renderiza CTA 'Ver estoque completo' apontando pra /estoque do site", () => {
    render(
      <HomeRecentArrivals
        cars={SITE_FIXTURE.cars}
        siteSlug={SLUG}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
      />,
    );
    const cta = screen.getByRole("link", { name: /ver estoque completo/i });
    expect(cta.getAttribute("href")).toBe(`/sites/${SLUG}/estoque`);
  });

  it("empty state — `cars.length === 0` renderiza trust signals + WhatsApp CTA generic", () => {
    render(
      <HomeRecentArrivals
        cars={[]}
        siteSlug={SLUG}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
      />,
    );
    // Trust copy (não-vazia) em vez de seção em branco.
    const emptyRegion = screen.getByTestId("home-recent-arrivals-empty");
    expect(emptyRegion).toBeInTheDocument();
    // WhatsApp CTA usa template 'general' → utm_campaign=general.
    const cta = within(emptyRegion).getByRole("link", { name: /whatsapp/i });
    const href = cta.getAttribute("href") ?? "";
    expect(href).toContain("wa.me/");
    expect(href).toContain("utm_campaign=general");
  });

  it("a11y — jest-axe ZERO violations no estado preenchido", async () => {
    const { container } = render(
      <HomeRecentArrivals
        cars={SITE_FIXTURE.cars}
        siteSlug={SLUG}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("a11y — jest-axe ZERO violations no empty state", async () => {
    const { container } = render(
      <HomeRecentArrivals
        cars={[]}
        siteSlug={SLUG}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
