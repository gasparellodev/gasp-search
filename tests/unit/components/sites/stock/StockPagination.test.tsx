import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StockPagination } from "@/components/sites/stock/StockPagination";

describe("<StockPagination />", () => {
  it("renderiza paginação numerada desktop com indicador", () => {
    render(
      <StockPagination
        page={2}
        totalPages={4}
        pageSize={12}
        hasNextPage
        hasPreviousPage
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Página 2 de 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Ir para página 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeEnabled();
  });

  it("desabilita prev/next nos limites", () => {
    render(
      <StockPagination
        page={1}
        totalPages={1}
        pageSize={12}
        hasNextPage={false}
        hasPreviousPage={false}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Carregar mais/i })).toBeNull();
  });

  it("mobile load-more chama a próxima página", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <StockPagination
        page={1}
        totalPages={3}
        pageSize={12}
        hasNextPage
        hasPreviousPage={false}
        onPageChange={onPageChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Carregar mais 12" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
