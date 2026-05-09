import { render, screen, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { StockSection } from "@/components/sites/stock/StockSection";
import type { SiteVariables } from "@/types/lead-site";

import { SITE_FIXTURE } from "../site-fixtures";

expect.extend(toHaveNoViolations);

const SLUG = "j7k2p9-touring-cars";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<StockSection /> — sem filtro", () => {
  it("renderiza todos os carros do fixture", () => {
    render(
      <StockSection
        variables={SITE_FIXTURE}
        categoriaFilter={null}
        slug={SLUG}
      />,
    );
    const grid = screen.getByTestId("stock-grid");
    const items = within(grid).getAllByRole("listitem");
    expect(items).toHaveLength(SITE_FIXTURE.cars.length);
  });

  it("ordena featured-first", () => {
    render(
      <StockSection
        variables={SITE_FIXTURE}
        categoriaFilter={null}
        slug={SLUG}
      />,
    );
    const grid = screen.getByTestId("stock-grid");
    const cards = within(grid).getAllByRole("link");
    // Toyota Corolla é o único featured no fixture → deve ser primeiro.
    expect(cards[0]).toHaveAttribute(
      "href",
      `/sites/${SLUG}/estoque/toyota-corolla-2022`,
    );
  });

  it("renderiza <h1> 'Estoque'", () => {
    render(
      <StockSection
        variables={SITE_FIXTURE}
        categoriaFilter={null}
        slug={SLUG}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /Estoque/i }),
    ).toBeInTheDocument();
  });
});

describe("<StockSection /> — com filtro", () => {
  it("?categoria=sedan: lista apenas Corolla (sedan)", () => {
    render(
      <StockSection
        variables={SITE_FIXTURE}
        categoriaFilter="sedan"
        slug={SLUG}
      />,
    );
    expect(
      screen.getByTestId("car-card-toyota-corolla-2022"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("car-card-honda-civic-2021")).toBeInTheDocument();
    // T-Cross é SUV — não deve aparecer.
    expect(screen.queryByTestId("car-card-vw-tcross-2020")).toBeNull();
  });

  it("?categoria=suv: lista apenas T-Cross", () => {
    render(
      <StockSection
        variables={SITE_FIXTURE}
        categoriaFilter="suv"
        slug={SLUG}
      />,
    );
    expect(
      screen.getByTestId("car-card-vw-tcross-2020"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("car-card-toyota-corolla-2022"),
    ).toBeNull();
  });

  it("multi-select: ?categoria=sedan,suv lista sedan + suv", () => {
    render(
      <StockSection
        variables={SITE_FIXTURE}
        categoriaFilter="sedan,suv"
        slug={SLUG}
      />,
    );
    expect(
      screen.getByTestId("car-card-toyota-corolla-2022"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("car-card-vw-tcross-2020")).toBeInTheDocument();
  });

  it("token inválido: ?categoria=xxx → trata como sem filtro (lista todos)", () => {
    render(
      <StockSection
        variables={SITE_FIXTURE}
        categoriaFilter="xxx"
        slug={SLUG}
      />,
    );
    const grid = screen.getByTestId("stock-grid");
    const items = within(grid).getAllByRole("listitem");
    expect(items).toHaveLength(SITE_FIXTURE.cars.length);
  });
});

describe("<StockSection /> — empty state", () => {
  it("0 matches → mensagem PT-BR + link 'Ver todos'", () => {
    // Construir SiteVariables com cars que NUNCA classificam como esportivo
    const variables: SiteVariables = {
      ...SITE_FIXTURE,
      cars: SITE_FIXTURE.cars,
    };

    render(
      <StockSection
        variables={variables}
        categoriaFilter="esportivo"
        slug={SLUG}
      />,
    );

    expect(screen.getByTestId("stock-empty")).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhum carro encontrado/i),
    ).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /Ver estoque completo/i });
    expect(link).toHaveAttribute("href", `/sites/${SLUG}/estoque`);
  });

  it("não renderiza <StockGrid> quando empty", () => {
    render(
      <StockSection
        variables={SITE_FIXTURE}
        categoriaFilter="esportivo"
        slug={SLUG}
      />,
    );
    expect(screen.queryByTestId("stock-grid")).toBeNull();
  });
});

describe("<StockSection /> — XSS hardening", () => {
  it("não usa dangerouslySetInnerHTML em nenhum nó", () => {
    const adversarial = {
      ...SITE_FIXTURE,
      cars: [
        {
          ...SITE_FIXTURE.cars[0]!,
          description: "<script>alert('xss')</script>",
        },
      ],
    };
    const { container } = render(
      <StockSection
        variables={adversarial}
        categoriaFilter={null}
        slug={SLUG}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
  });
});

describe("<StockSection /> — a11y runtime", () => {
  it("não tem violações axe-core (a11y runtime)", async () => {
    const { container } = render(
      <StockSection
        variables={SITE_FIXTURE}
        categoriaFilter={null}
        slug={SLUG}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
