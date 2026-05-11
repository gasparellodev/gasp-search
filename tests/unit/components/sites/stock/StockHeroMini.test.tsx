import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StockHeroMini } from "@/components/sites/stock/StockHeroMini";

import { SITE_FIXTURE } from "../site-fixtures";

describe("<StockHeroMini />", () => {
  it("renderiza h1 Nosso Estoque e contagem de carros", () => {
    render(<StockHeroMini variables={SITE_FIXTURE} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Nosso Estoque" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${SITE_FIXTURE.cars.length} carros disponíveis`),
    ).toBeInTheDocument();
  });

  it("preserva o bloco AI-citable logo depois do h1", () => {
    render(<StockHeroMini variables={SITE_FIXTURE} />);

    const hero = screen.getByTestId("stock-hero-mini");
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Nosso Estoque",
    });
    const passage = screen.getByTestId("ai-citable-hero");

    expect(hero).toContainElement(heading);
    expect(hero).toContainElement(passage);
  });
});
