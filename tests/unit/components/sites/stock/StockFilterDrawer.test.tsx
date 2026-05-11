import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { StockFilterDrawer } from "@/components/sites/stock/StockFilterDrawer";
import {
  parseStockFilters,
  type StockFilterFacets,
} from "@/lib/sites/stock-search-params";

expect.extend(toHaveNoViolations);

const FACETS: StockFilterFacets = {
  marcas: ["Toyota"],
  modelos: ["Corolla"],
  categorias: ["sedan", "suv", "hatch", "pickup", "esportivo", "conversivel"],
  cambios: ["Automático"],
  combustiveis: ["Flex"],
  cores: ["prata"],
  ranges: {
    preco: { min: 59900, max: 119900 },
    parcela: { min: 900, max: 2500 },
    ano: { min: 2019, max: 2022 },
    km: { min: 35000, max: 71000 },
  },
};

describe("<StockFilterDrawer />", () => {
  it("renderiza bottom sheet aberto com DialogTitle e max-height 90dvh", () => {
    render(
      <StockFilterDrawer
        open
        facets={FACETS}
        filters={parseStockFilters({ m: "Toyota" })}
        onOpenChange={vi.fn()}
        onFiltersChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Filtros" })).toBeInTheDocument();
    expect(screen.getByTestId("stock-filter-drawer-content").className).toContain(
      "max-h-[90dvh]",
    );
  });

  it("fecha pelo botão de fechar", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <StockFilterDrawer
        open
        facets={FACETS}
        filters={parseStockFilters({})}
        onOpenChange={onOpenChange}
        onFiltersChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Fechar filtros" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("não tem violações axe-core quando aberto", async () => {
    const { container } = render(
      <StockFilterDrawer
        open
        facets={FACETS}
        filters={parseStockFilters({})}
        onOpenChange={vi.fn()}
        onFiltersChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
