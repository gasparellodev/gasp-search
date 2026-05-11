import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StockGrid } from "@/components/sites/stock/StockGrid";

import { SITE_FIXTURE } from "../site-fixtures";

const SLUG = "j7k2p9-touring-cars";
const WHATSAPP = SITE_FIXTURE.whatsapp;
const BUSINESS = SITE_FIXTURE.business_name;

function renderGrid(cars = SITE_FIXTURE.cars) {
  return render(
    <StockGrid
      cars={cars}
      slug={SLUG}
      whatsappPhone={WHATSAPP}
      businessName={BUSINESS}
    />,
  );
}

describe("<StockGrid />", () => {
  it("renderiza 1 card por carro", () => {
    renderGrid();
    const grid = screen.getByTestId("stock-grid");
    const items = within(grid).getAllByRole("listitem");
    expect(items).toHaveLength(SITE_FIXTURE.cars.length);
  });

  it("cada card tem `data-testid=car-card-<slug>`", () => {
    renderGrid();
    for (const car of SITE_FIXTURE.cars) {
      expect(
        screen.getByTestId(`car-card-${car.slug}`),
      ).toBeInTheDocument();
    }
  });

  it("href do card é `/sites/<slug>/estoque/<car.slug>`", () => {
    renderGrid();
    const car = SITE_FIXTURE.cars[0]!;
    const link = screen.getByTestId(`car-card-${car.slug}-link`);
    expect(link).toHaveAttribute(
      "href",
      `/sites/${SLUG}/estoque/${car.slug}`,
    );
  });

  it("renderiza brand, model e year", () => {
    renderGrid();
    const car = SITE_FIXTURE.cars[0]!; // Toyota Corolla 2022
    const card = screen.getByTestId(`car-card-${car.slug}`);
    expect(within(card).getByText(/Toyota/)).toBeInTheDocument();
    expect(within(card).getByText(/Corolla/)).toBeInTheDocument();
    expect(within(card).getByText(/2022/)).toBeInTheDocument();
  });

  it("formata price em BRL via Intl.NumberFormat", () => {
    renderGrid();
    const car = SITE_FIXTURE.cars[0]!; // price = 119900
    const card = screen.getByTestId(`car-card-${car.slug}`);
    // pt-BR sem decimais → "R$ 119.900"
    expect(within(card).getByText(/R\$\s?119\.900/)).toBeInTheDocument();
  });

  it("renderiza 'Sob consulta' quando price é null", () => {
    const cars = [
      { ...SITE_FIXTURE.cars[0]!, price: null, slug: "sem-preco" },
    ];
    renderGrid(cars);
    expect(screen.getByText("Sob consulta")).toBeInTheDocument();
  });

  it("usa o CarCard compartilhado com raio 8px e WhatsApp inline", () => {
    renderGrid();
    const car = SITE_FIXTURE.cars[0]!;
    const card = screen.getByTestId(`car-card-${car.slug}`);
    expect(card.className).toContain("rounded-[var(--auto-radius-md,8px)]");
    expect(
      within(card).getByTestId(`car-card-${car.slug}-whatsapp`),
    ).toHaveAttribute("href", expect.stringContaining("utm_content=stock-card"));
  });

  it("imagem com alt brand+model+year", () => {
    renderGrid();
    expect(
      screen.getByAltText("Toyota Corolla 2022"),
    ).toBeInTheDocument();
  });
});
