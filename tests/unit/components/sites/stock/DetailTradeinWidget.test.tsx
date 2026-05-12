/**
 * Unit tests — `<DetailTradeinWidget>` (Phase 7 / Sprint 6 / #D3 —
 * issue #228).
 *
 * Widget cross-conversion bg-muted no detalhe do carro: "Use seu carro
 * como entrada" + button "AVALIAR" → `/anunciar?car_target_slug=...`.
 *
 * Por que `car_target_slug` (e não `?car=`)? Coordenado com a issue
 * #231 (`/anunciar` O3) — vai ler esse param pra pré-popular o form
 * mostrando "Trocando pelo {brand} {model}". Funciona mesmo se #231
 * ainda não merged — graceful fallback (rota existe e ignora param
 * desconhecido).
 */
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { DetailTradeinWidget } from "@/components/sites/stock/DetailTradeinWidget";

expect.extend(toHaveNoViolations);

describe("<DetailTradeinWidget>", () => {
  const defaultProps = {
    slug: "auto-fit",
    currentCarSlug: "bmw-m2-2023-001",
  };

  it("renderiza o h2 'Use seu carro como entrada'", () => {
    render(<DetailTradeinWidget {...defaultProps} />);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /use seu carro como entrada/i,
      }),
    ).toBeInTheDocument();
  });

  it("tem CTA 'AVALIAR' como link", () => {
    render(<DetailTradeinWidget {...defaultProps} />);
    const cta = screen.getByRole("link", { name: /avaliar/i });
    expect(cta).toBeInTheDocument();
  });

  it("link aponta para /sites/<slug>/anunciar?car_target_slug=<currentCarSlug>", () => {
    render(<DetailTradeinWidget {...defaultProps} />);
    const cta = screen.getByRole("link", { name: /avaliar/i });
    expect(cta).toHaveAttribute(
      "href",
      "/sites/auto-fit/anunciar?car_target_slug=bmw-m2-2023-001",
    );
  });

  it("encoda querystring corretamente para slugs com chars especiais", () => {
    render(
      <DetailTradeinWidget
        slug="auto-fit"
        currentCarSlug="carro com espaço & ampersand"
      />,
    );
    const cta = screen.getByRole("link", { name: /avaliar/i });
    const href = cta.getAttribute("href");
    expect(href).toContain("car_target_slug=");
    // Nenhum espaço ou & nu na querystring
    expect(href).not.toContain("car_target_slug=carro com");
    expect(href).not.toMatch(/&[^a-zA-Z]/);
  });

  it("tem data-testid='detail-tradein-widget' no root", () => {
    const { container } = render(<DetailTradeinWidget {...defaultProps} />);
    expect(
      container.querySelector("[data-testid='detail-tradein-widget']"),
    ).not.toBeNull();
  });

  it("não tem violações axe-core críticas/sérias", async () => {
    const { container } = render(<DetailTradeinWidget {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
