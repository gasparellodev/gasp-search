import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { StockSearchBar } from "@/components/sites/stock/StockSearchBar";

describe("<StockSearchBar />", () => {
  it("renderiza busca, sort e botão mobile de filtros com badge", () => {
    render(
      <StockSearchBar
        search="Corolla"
        sort="price"
        activeFilterCount={3}
        resultCount={2}
        totalCount={4}
        onSearchChange={vi.fn()}
        onSortChange={vi.fn()}
        onOpenFilters={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Buscar por marca ou modelo")).toHaveValue(
      "Corolla",
    );
    expect(screen.getByLabelText("Ordenar estoque")).toHaveValue("price");
    expect(screen.getByRole("button", { name: /Filtros 3/i })).toBeVisible();
    expect(screen.getByText("2 de 4 carros")).toBeInTheDocument();
  });

  it("dispara callbacks de busca, sort e abertura do drawer", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    const onSortChange = vi.fn();
    const onOpenFilters = vi.fn();

    function Harness() {
      const [search, setSearch] = useState("");
      return (
        <StockSearchBar
          search={search}
          sort="featured"
          activeFilterCount={0}
          resultCount={4}
          totalCount={4}
          onSearchChange={(value) => {
            setSearch(value);
            onSearchChange(value);
          }}
          onSortChange={onSortChange}
          onOpenFilters={onOpenFilters}
        />
      );
    }

    render(<Harness />);

    await user.type(screen.getByLabelText("Buscar por marca ou modelo"), "hb");
    await user.selectOptions(screen.getByLabelText("Ordenar estoque"), "year");
    await user.click(screen.getByRole("button", { name: /Filtros/i }));

    expect(onSearchChange).toHaveBeenLastCalledWith("hb");
    expect(onSortChange).toHaveBeenCalledWith("year");
    expect(onOpenFilters).toHaveBeenCalledTimes(1);
  });
});
