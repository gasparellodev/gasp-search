import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StockGrid } from "@/components/sites/stock/StockGrid";

import { SITE_FIXTURE } from "../site-fixtures";

const SLUG = "j7k2p9-touring-cars";

describe("<StockGrid />", () => {
  it("renderiza 1 card por carro", () => {
    render(<StockGrid cars={SITE_FIXTURE.cars} slug={SLUG} />);
    const grid = screen.getByTestId("stock-grid");
    const items = within(grid).getAllByRole("listitem");
    expect(items).toHaveLength(SITE_FIXTURE.cars.length);
  });

  it("cada card tem `data-testid=car-card-<slug>`", () => {
    render(<StockGrid cars={SITE_FIXTURE.cars} slug={SLUG} />);
    for (const car of SITE_FIXTURE.cars) {
      expect(
        screen.getByTestId(`car-card-${car.slug}`),
      ).toBeInTheDocument();
    }
  });

  it("href do card é `/sites/<slug>/estoque/<car.slug>`", () => {
    render(<StockGrid cars={SITE_FIXTURE.cars} slug={SLUG} />);
    const car = SITE_FIXTURE.cars[0]!;
    const link = screen.getByTestId(`car-card-${car.slug}`);
    expect(link).toHaveAttribute(
      "href",
      `/sites/${SLUG}/estoque/${car.slug}`,
    );
  });

  it("renderiza brand, model e year", () => {
    render(<StockGrid cars={SITE_FIXTURE.cars} slug={SLUG} />);
    const car = SITE_FIXTURE.cars[0]!; // Toyota Corolla 2022
    const card = screen.getByTestId(`car-card-${car.slug}`);
    expect(within(card).getByText(/Toyota/)).toBeInTheDocument();
    expect(within(card).getByText(/Corolla/)).toBeInTheDocument();
    expect(within(card).getByText(/2022/)).toBeInTheDocument();
  });

  it("formata price em BRL via Intl.NumberFormat", () => {
    render(<StockGrid cars={SITE_FIXTURE.cars} slug={SLUG} />);
    const car = SITE_FIXTURE.cars[0]!; // price = 119900
    const card = screen.getByTestId(`car-card-${car.slug}`);
    // pt-BR sem decimais → "R$ 119.900"
    expect(within(card).getByText(/R\$\s?119\.900/)).toBeInTheDocument();
  });

  it("renderiza 'Sob consulta' quando price é null", () => {
    const cars = [
      { ...SITE_FIXTURE.cars[0]!, price: null, slug: "sem-preco" },
    ];
    render(<StockGrid cars={cars} slug={SLUG} />);
    expect(screen.getByText("Sob consulta")).toBeInTheDocument();
  });

  it("renderiza badge 'Destaque' apenas em cars com `featured: true`", () => {
    render(<StockGrid cars={SITE_FIXTURE.cars} slug={SLUG} />);
    const featuredCar = SITE_FIXTURE.cars.find((c) => c.featured)!;
    const nonFeaturedCar = SITE_FIXTURE.cars.find((c) => !c.featured)!;

    const featuredCard = screen.getByTestId(`car-card-${featuredCar.slug}`);
    expect(
      within(featuredCard).getByTestId("car-card-featured-badge"),
    ).toBeInTheDocument();

    const nonFeaturedCard = screen.getByTestId(
      `car-card-${nonFeaturedCar.slug}`,
    );
    expect(
      within(nonFeaturedCard).queryByTestId("car-card-featured-badge"),
    ).toBeNull();
  });

  it("imagem com alt brand+model+year", () => {
    render(<StockGrid cars={SITE_FIXTURE.cars} slug={SLUG} />);
    expect(
      screen.getByAltText("Toyota Corolla 2022"),
    ).toBeInTheDocument();
  });
});
