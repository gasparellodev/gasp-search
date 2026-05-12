import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailBreadcrumb } from "@/components/sites/stock/DetailBreadcrumb";

const SLUG = "j7k2p9-touring-cars";

describe("<DetailBreadcrumb />", () => {
  it("compõe o Breadcrumb shared com estoque, marca filtrada e veículo atual", () => {
    render(
      <DetailBreadcrumb
        slug={SLUG}
        brand="Toyota"
        model="Corolla"
        year={2022}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const stock = screen.getByRole("link", { name: "Estoque" });
    const brand = screen.getByRole("link", { name: "Toyota" });
    const current = screen.getByText("Corolla 2022");

    expect(nav).toBeInTheDocument();
    expect(stock).toHaveAttribute("href", `/sites/${SLUG}/estoque`);
    expect(brand).toHaveAttribute("href", `/sites/${SLUG}/estoque?m=Toyota`);
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("codifica marcas com espaços no filtro de estoque", () => {
    render(
      <DetailBreadcrumb
        slug={SLUG}
        brand="Mercedes Benz"
        model="C 180"
        year={2023}
      />,
    );

    expect(screen.getByRole("link", { name: "Mercedes Benz" })).toHaveAttribute(
      "href",
      `/sites/${SLUG}/estoque?m=Mercedes%20Benz`,
    );
  });
});
