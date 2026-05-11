import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StockSortDropdown } from "@/components/sites/stock/StockSortDropdown";

describe("<StockSortDropdown />", () => {
  it("expõe as 5 opções do sort de estoque", async () => {
    const user = userEvent.setup();
    render(<StockSortDropdown value="most_recent" onValueChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox", { name: "Ordenar estoque" }));

    expect(screen.getByRole("option", { name: "Mais recentes" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Menor preço" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Maior preço" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Menor parcela" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Menor km" })).toBeInTheDocument();
  });

  it("chama onValueChange com a opção escolhida", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <StockSortDropdown value="most_recent" onValueChange={onValueChange} />,
    );

    await user.click(screen.getByRole("combobox", { name: "Ordenar estoque" }));
    await user.click(screen.getByRole("option", { name: "Maior preço" }));

    expect(onValueChange).toHaveBeenCalledWith("price_desc");
  });
});
