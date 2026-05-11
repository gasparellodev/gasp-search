/**
 * Testes do <HomeTrustStrip /> (issue #221 / Sprint 4 / H1).
 *
 * Strip 4 colunas full-bleed: Garantia (estático), Vistoria (estático),
 * Anos no mercado (dinâmico — props), Rating + reviews (dinâmico — props).
 *
 * Regras de fallback canônicas (PO refinement #221):
 *   - `years_in_market` undef/null/0 → "Mais de 10 anos"
 *   - `years_in_market === 1` → "1 ano no mercado"
 *   - `years_in_market ≥ 2` → "${N} anos no mercado"
 *   - props `rating`/`reviewsCount` ausentes → fallback "4.8★ 87 reviews"
 */
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { HomeTrustStrip } from "@/components/sites/home/HomeTrustStrip";

expect.extend(toHaveNoViolations);

describe("<HomeTrustStrip />", () => {
  it("renderiza região com label PT-BR pra leitores de tela", () => {
    render(<HomeTrustStrip />);
    expect(
      screen.getByRole("region", { name: /diferenciais/i }),
    ).toBeInTheDocument();
  });

  it("renderiza items estáticos garantia + vistoria 100 pontos", () => {
    render(<HomeTrustStrip />);
    expect(screen.getByText(/garantia inclu/i)).toBeInTheDocument();
    expect(screen.getByText(/vistoria 100 pontos/i)).toBeInTheDocument();
  });

  describe("years_in_market fallback rules (PO refinement)", () => {
    it("undefined → 'Mais de 10 anos'", () => {
      render(<HomeTrustStrip />);
      expect(screen.getByText(/mais de 10 anos/i)).toBeInTheDocument();
    });

    it("null → 'Mais de 10 anos'", () => {
      render(<HomeTrustStrip yearsInMarket={null} />);
      expect(screen.getByText(/mais de 10 anos/i)).toBeInTheDocument();
    });

    it("0 → 'Mais de 10 anos'", () => {
      render(<HomeTrustStrip yearsInMarket={0} />);
      expect(screen.getByText(/mais de 10 anos/i)).toBeInTheDocument();
    });

    it("1 → '1 ano no mercado' (singular)", () => {
      render(<HomeTrustStrip yearsInMarket={1} />);
      expect(screen.getByText(/^1 ano no mercado$/)).toBeInTheDocument();
    });

    it("2 → '2 anos no mercado'", () => {
      render(<HomeTrustStrip yearsInMarket={2} />);
      expect(screen.getByText(/^2 anos no mercado$/)).toBeInTheDocument();
    });

    it("15 → '15 anos no mercado'", () => {
      render(<HomeTrustStrip yearsInMarket={15} />);
      expect(screen.getByText(/^15 anos no mercado$/)).toBeInTheDocument();
    });
  });

  describe("rating/reviewsCount fallback (PO refinement)", () => {
    it("ausência total → fallback '4.8★ 87 reviews'", () => {
      render(<HomeTrustStrip />);
      expect(screen.getByText(/4\.8★ 87 reviews/)).toBeInTheDocument();
    });

    it("rating 4.7 + 123 reviews → '4.7★ 123 reviews'", () => {
      render(<HomeTrustStrip rating={4.7} reviewsCount={123} />);
      expect(screen.getByText(/4\.7★ 123 reviews/)).toBeInTheDocument();
    });

    it("rating 5 (inteiro) renderiza com 1 casa decimal (toFixed(1))", () => {
      render(<HomeTrustStrip rating={5} reviewsCount={50} />);
      expect(screen.getByText(/5\.0★ 50 reviews/)).toBeInTheDocument();
    });

    it("rating presente mas reviewsCount ausente → cai no fallback", () => {
      render(<HomeTrustStrip rating={4.5} />);
      // Sem reviewsCount: usa fallback (lê tudo ou nada — evita "X.X★ N undefined")
      expect(screen.getByText(/4\.8★ 87 reviews/)).toBeInTheDocument();
    });

    it("reviewsCount 0 → cai no fallback (sem reviews é semanticamente fallback)", () => {
      render(<HomeTrustStrip rating={4.0} reviewsCount={0} />);
      expect(screen.getByText(/4\.8★ 87 reviews/)).toBeInTheDocument();
    });
  });

  it("renderiza com 4 items semanticamente acessíveis em <ul>", () => {
    render(<HomeTrustStrip yearsInMarket={5} rating={4.9} reviewsCount={100} />);
    const list = screen.getByRole("list");
    expect(list.querySelectorAll("li")).toHaveLength(4);
  });

  it("aplica full-bleed via classes Tailwind canônicas", () => {
    render(<HomeTrustStrip />);
    const region = screen.getByRole("region", { name: /diferenciais/i });
    // Conforme AC: full-bleed via `relative left-1/2 -translate-x-1/2 w-screen`
    expect(region.className).toMatch(/w-screen/);
    expect(region.className).toMatch(/left-1\/2/);
  });

  it("zero violations a11y (axe-core)", async () => {
    const { container } = render(
      <HomeTrustStrip yearsInMarket={5} rating={4.8} reviewsCount={87} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
