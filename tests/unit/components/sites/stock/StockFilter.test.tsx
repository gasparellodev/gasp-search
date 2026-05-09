import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

import { StockFilter } from "@/components/sites/stock/StockFilter";
import type { CarCategorySlug } from "@/components/sites/stock/car-categories";

const SLUG = "j7k2p9-touring-cars";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<StockFilter />", () => {
  it("renderiza um checkbox por categoria conhecida", () => {
    render(<StockFilter slug={SLUG} active={new Set()} />);
    expect(screen.getByLabelText(/Sedan/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^SUV$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Picape/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hatch/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Esportivo/i)).toBeInTheDocument();
  });

  it("checkbox correspondente a `active` vem checked", () => {
    const active = new Set<CarCategorySlug>(["sedan", "suv"]);
    render(<StockFilter slug={SLUG} active={active} />);
    expect(
      (screen.getByLabelText(/^Sedan$/i) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText(/^SUV$/i) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText(/^Hatch$/i) as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("toggle ON: clicar checkbox vazio chama router.push com `?categoria=<slug>`", async () => {
    const user = userEvent.setup();
    render(<StockFilter slug={SLUG} active={new Set()} />);
    await user.click(screen.getByLabelText(/^Sedan$/i));
    expect(routerMocks.push).toHaveBeenCalledWith(
      `/sites/${SLUG}/estoque?categoria=sedan`,
    );
  });

  it("toggle OFF: desmarcar último ativo chama router.push sem ?categoria", async () => {
    const user = userEvent.setup();
    render(
      <StockFilter slug={SLUG} active={new Set<CarCategorySlug>(["sedan"])} />,
    );
    await user.click(screen.getByLabelText(/^Sedan$/i));
    expect(routerMocks.push).toHaveBeenCalledWith(`/sites/${SLUG}/estoque`);
  });

  it("multi-select: ordem da URL é determinística", async () => {
    const user = userEvent.setup();
    render(
      <StockFilter slug={SLUG} active={new Set<CarCategorySlug>(["suv"])} />,
    );
    // Clica sedan → resultado deve ser ?categoria=sedan,suv (sedan vem antes
    // de suv per CATEGORY_LABELS).
    await user.click(screen.getByLabelText(/^Sedan$/i));
    expect(routerMocks.push).toHaveBeenCalledWith(
      `/sites/${SLUG}/estoque?categoria=sedan,suv`,
    );
  });

  it("usa role=group e legend acessível", () => {
    render(<StockFilter slug={SLUG} active={new Set()} />);
    // <fieldset> e <div role="group"> ambos sobem como role=group em
    // ARIA — esperamos pelo menos um e a legend visível.
    expect(screen.getAllByRole("group").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Filtrar por categoria/i)).toBeInTheDocument();
  });

  it("expõe data-testid `stock-filter` no fieldset", () => {
    render(<StockFilter slug={SLUG} active={new Set()} />);
    expect(screen.getByTestId("stock-filter")).toBeInTheDocument();
  });
});
