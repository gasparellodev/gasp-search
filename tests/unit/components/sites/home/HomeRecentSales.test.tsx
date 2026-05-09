import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeRecentSales } from "@/components/sites/home/HomeRecentSales";

import { SITE_FIXTURE } from "../site-fixtures";

describe("<HomeRecentSales />", () => {
  it("renderiza um <h2> de seção", () => {
    render(<HomeRecentSales recent_sales={SITE_FIXTURE.recent_sales} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /vendas recentes/i }),
    ).toBeInTheDocument();
  });

  it("renderiza 3 cards com `car_name` cada", () => {
    render(<HomeRecentSales recent_sales={SITE_FIXTURE.recent_sales} />);
    for (const sale of SITE_FIXTURE.recent_sales) {
      expect(screen.getByText(sale.car_name)).toBeInTheDocument();
    }
  });

  it("renderiza imagem com alt `Venda recente — <car_name>`", () => {
    render(<HomeRecentSales recent_sales={SITE_FIXTURE.recent_sales} />);
    for (const sale of SITE_FIXTURE.recent_sales) {
      expect(
        screen.getByAltText(`Venda recente — ${sale.car_name}`),
      ).toBeInTheDocument();
    }
  });

  it("usa container com horizontal-scroll snap em mobile", () => {
    const { container } = render(
      <HomeRecentSales recent_sales={SITE_FIXTURE.recent_sales} />,
    );
    const scroller = container.querySelector(
      "[data-testid='recent-sales-scroller']",
    );
    expect(scroller).not.toBeNull();
    // snap-x snap-mandatory overflow-x-auto presentes nas classes (mobile)
    expect(scroller?.className).toMatch(/overflow-x-auto/);
    expect(scroller?.className).toMatch(/snap-x/);
  });
});
