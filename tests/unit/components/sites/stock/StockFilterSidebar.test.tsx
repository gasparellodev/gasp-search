import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { StockFilterSidebar } from "@/components/sites/stock/StockFilterSidebar";
import {
  parseStockFilters,
  type StockFilterFacets,
  type StockFilters,
} from "@/lib/sites/stock-search-params";

expect.extend(toHaveNoViolations);

const FACETS: StockFilterFacets = {
  marcas: ["Toyota", "Honda"],
  modelos: ["Corolla", "Civic"],
  categorias: ["sedan", "suv", "hatch", "pickup", "esportivo", "conversivel"],
  cambios: ["Manual", "Automático", "CVT", "Outros"],
  combustiveis: ["Flex", "Gasolina"],
  cores: ["prata", "branco"],
  ranges: {
    preco: { min: 59900, max: 119900 },
    parcela: { min: 900, max: 2500 },
    ano: { min: 2019, max: 2022 },
    km: { min: 35000, max: 71000 },
  },
};

describe("<StockFilterSidebar />", () => {
  it("renderiza 10 sections, marca/modelo abertas por default e badges de contagem", () => {
    render(
      <StockFilterSidebar
        facets={FACETS}
        filters={parseStockFilters({ m: "Toyota,Honda", model: "Corolla" })}
        onFiltersChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByTestId("stock-filter-sidebar")).toBeInTheDocument();
    expect(screen.getAllByTestId("stock-filter-section")).toHaveLength(10);
    expect(screen.getByRole("button", { name: /Marca \(2\)/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getByRole("button", { name: /Modelo \(1\)/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /^Categoria$/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("altera checkbox e inputs numéricos via callbacks", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();

    function Harness() {
      const [filters, setFilters] = useState<StockFilters>(parseStockFilters({}));
      return (
        <StockFilterSidebar
          facets={FACETS}
          filters={filters}
          onFiltersChange={(next) => {
            setFilters(next);
            onFiltersChange(next);
          }}
          onClear={vi.fn()}
        />
      );
    }

    render(<Harness />);

    await user.click(screen.getByLabelText("Toyota"));
    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ marca: ["Toyota"] }),
    );

    await user.click(screen.getByRole("button", { name: "Faixa preço" }));
    await user.clear(screen.getByLabelText("Preço mínimo"));
    await user.type(screen.getByLabelText("Preço mínimo"), "70000");
    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ precoMin: 70000 }),
    );
  });

  it("dispara limpar filtros", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();

    render(
      <StockFilterSidebar
        facets={FACETS}
        filters={parseStockFilters({ m: "Toyota" })}
        onFiltersChange={vi.fn()}
        onClear={onClear}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Limpar filtros/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("não tem violações axe-core", async () => {
    const { container } = render(
      <StockFilterSidebar
        facets={FACETS}
        filters={parseStockFilters({ m: "Toyota" })}
        onFiltersChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
