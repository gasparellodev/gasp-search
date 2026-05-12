/**
 * Unit tests — `<DetailSimilarVehicles>` (Phase 7 / Sprint 6 / #D3 —
 * issue #228).
 *
 * Section "Veículos similares" no detalhe do carro. Consome
 * `findSimilarCars` e renderiza:
 *
 *  - Grid de até `limit=4` `<CarCard>`s (shared, vide #201).
 *  - Sub-bloco "Você também pode gostar" (badge) quando há
 *    `fallback.length > 0` (similar < limit, top-priced fillers).
 *  - Empty state (estoque < 4 total ou nenhum match): 1-3 cards (se
 *    houver) + CTA "Ver estoque completo".
 *  - `null` quando o pool inteiro é vazio (defensivo).
 *
 * Mobile: scroll-snap horizontal `snap-x snap-mandatory + scroll-padding`.
 */
import { render, screen, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { DetailSimilarVehicles } from "@/components/sites/stock/DetailSimilarVehicles";
import type { SiteCar } from "@/types/lead-site";

expect.extend(toHaveNoViolations);

// ---------------------------------------------------------------------------
// Local factory
// ---------------------------------------------------------------------------

let carCounter = 0;
function makeCar(overrides: Partial<SiteCar> = {}): SiteCar {
  carCounter += 1;
  const idx = carCounter;
  return {
    slug: `car-${idx}`,
    brand: "Toyota",
    model: `Modelo ${idx}`,
    year: 2022,
    km: 30000,
    price: 100000,
    transmission: "Automático",
    fuel: "Flex",
    color: "Prata",
    description:
      "Carro seminovo revisado em concessionária autorizada. Documentação em dia, garantia da loja por 3 meses cobrindo motor e câmbio. Aceita troca.",
    thumbnail_url: `/assets/stock/car-${idx}.png`,
    gallery_urls: [
      `/assets/stock/car-${idx}-1.png`,
      `/assets/stock/car-${idx}-2.png`,
      `/assets/stock/car-${idx}-3.png`,
    ],
    datasheet: [["Motor", "1.0 Turbo"]],
    featured: false,
    ...overrides,
  };
}

const defaultProps = {
  slug: "auto-fit",
  whatsappPhone: "5511987654321",
  businessName: "Auto Fit",
};

// ---------------------------------------------------------------------------

describe("<DetailSimilarVehicles>", () => {
  it("retorna null quando não há outros carros no estoque", () => {
    const current = makeCar({ slug: "current", category: "Sedan" });
    const { container } = render(
      <DetailSimilarVehicles {...defaultProps} current={current} cars={[current]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza 4 cards quando há 4 similares dentro da faixa de preço", () => {
    const current = makeCar({
      slug: "current",
      category: "Sedan",
      price: 100000,
    });
    const cars = [
      current,
      makeCar({ slug: "s-1", category: "Sedan", price: 95000 }),
      makeCar({ slug: "s-2", category: "Sedan", price: 105000 }),
      makeCar({ slug: "s-3", category: "Sedan", price: 110000 }),
      makeCar({ slug: "s-4", category: "Sedan", price: 90000 }),
    ];
    render(
      <DetailSimilarVehicles {...defaultProps} current={current} cars={cars} />,
    );
    expect(screen.getByTestId("car-card-s-1")).toBeInTheDocument();
    expect(screen.getByTestId("car-card-s-2")).toBeInTheDocument();
    expect(screen.getByTestId("car-card-s-3")).toBeInTheDocument();
    expect(screen.getByTestId("car-card-s-4")).toBeInTheDocument();
    // Não renderiza o atual
    expect(screen.queryByTestId("car-card-current")).not.toBeInTheDocument();
  });

  it("renderiza heading 'Veículos similares' quando há similares", () => {
    const current = makeCar({
      slug: "current",
      category: "Sedan",
      price: 100000,
    });
    const cars = [
      current,
      makeCar({ slug: "s-1", category: "Sedan", price: 100000 }),
    ];
    render(
      <DetailSimilarVehicles {...defaultProps} current={current} cars={cars} />,
    );
    expect(
      screen.getByRole("heading", { name: /veículos similares/i }),
    ).toBeInTheDocument();
  });

  it("renderiza sub-bloco 'Você também pode gostar' quando há fallback", () => {
    // 1 sedan dentro da faixa + 3 SUVs (fallback top-priced)
    const current = makeCar({
      slug: "current",
      category: "Sedan",
      price: 100000,
    });
    const cars = [
      current,
      makeCar({ slug: "s-110", category: "Sedan", price: 110000 }),
      makeCar({ slug: "suv-500", category: "SUV", price: 500000 }),
      makeCar({ slug: "suv-400", category: "SUV", price: 400000 }),
      makeCar({ slug: "suv-300", category: "SUV", price: 300000 }),
    ];
    render(
      <DetailSimilarVehicles {...defaultProps} current={current} cars={cars} />,
    );
    expect(
      screen.getByRole("heading", { name: /você também pode gostar/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("car-card-suv-500")).toBeInTheDocument();
  });

  it("NÃO renderiza 'Você também pode gostar' quando fallback é vazio", () => {
    const current = makeCar({
      slug: "current",
      category: "Sedan",
      price: 100000,
    });
    const cars = [
      current,
      makeCar({ slug: "s-1", category: "Sedan", price: 95000 }),
      makeCar({ slug: "s-2", category: "Sedan", price: 105000 }),
      makeCar({ slug: "s-3", category: "Sedan", price: 110000 }),
      makeCar({ slug: "s-4", category: "Sedan", price: 90000 }),
    ];
    render(
      <DetailSimilarVehicles {...defaultProps} current={current} cars={cars} />,
    );
    expect(
      screen.queryByRole("heading", { name: /você também pode gostar/i }),
    ).not.toBeInTheDocument();
  });

  it("renderiza CTA 'Ver estoque completo' quando total cards < limit", () => {
    // Estoque pequeno: só 2 carros total (current + 1 similar)
    const current = makeCar({
      slug: "current",
      category: "Sedan",
      price: 100000,
    });
    const cars = [
      current,
      makeCar({ slug: "s-only", category: "Sedan", price: 105000 }),
    ];
    render(
      <DetailSimilarVehicles {...defaultProps} current={current} cars={cars} />,
    );
    const cta = screen.getByRole("link", { name: /ver estoque completo/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute("href", "/sites/auto-fit/estoque");
  });

  it("NÃO renderiza CTA 'Ver estoque completo' quando total === limit", () => {
    const current = makeCar({
      slug: "current",
      category: "Sedan",
      price: 100000,
    });
    const cars = [
      current,
      makeCar({ slug: "s-1", category: "Sedan", price: 95000 }),
      makeCar({ slug: "s-2", category: "Sedan", price: 105000 }),
      makeCar({ slug: "s-3", category: "Sedan", price: 110000 }),
      makeCar({ slug: "s-4", category: "Sedan", price: 90000 }),
    ];
    render(
      <DetailSimilarVehicles {...defaultProps} current={current} cars={cars} />,
    );
    expect(
      screen.queryByRole("link", { name: /ver estoque completo/i }),
    ).not.toBeInTheDocument();
  });

  it("aplica classes scroll-snap mobile no grid-wrapper", () => {
    const current = makeCar({
      slug: "current",
      category: "Sedan",
      price: 100000,
    });
    const cars = [
      current,
      makeCar({ slug: "s-1", category: "Sedan", price: 95000 }),
      makeCar({ slug: "s-2", category: "Sedan", price: 105000 }),
    ];
    const { container } = render(
      <DetailSimilarVehicles {...defaultProps} current={current} cars={cars} />,
    );
    const scroller = container.querySelector(
      "[data-testid='detail-similar-scroller']",
    );
    expect(scroller).not.toBeNull();
    expect(scroller).toHaveClass("snap-x");
    expect(scroller).toHaveClass("snap-mandatory");
  });

  it("tem data-testid='detail-similar-vehicles' no root", () => {
    const current = makeCar({
      slug: "current",
      category: "Sedan",
      price: 100000,
    });
    const cars = [
      current,
      makeCar({ slug: "s-1", category: "Sedan", price: 100000 }),
    ];
    const { container } = render(
      <DetailSimilarVehicles {...defaultProps} current={current} cars={cars} />,
    );
    const section = container.querySelector(
      "[data-testid='detail-similar-vehicles']",
    );
    expect(section).not.toBeNull();
  });

  it("não tem violações axe-core críticas/sérias", async () => {
    const current = makeCar({
      slug: "current",
      category: "Sedan",
      price: 100000,
    });
    const cars = [
      current,
      makeCar({ slug: "s-1", category: "Sedan", price: 95000 }),
      makeCar({ slug: "s-2", category: "Sedan", price: 105000 }),
      makeCar({ slug: "suv-500", category: "SUV", price: 500000 }),
      makeCar({ slug: "suv-300", category: "SUV", price: 300000 }),
    ];
    const { container } = render(
      <DetailSimilarVehicles {...defaultProps} current={current} cars={cars} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("CarCards renderizados recebem siteSlug + whatsappPhone + businessName corretos", () => {
    const current = makeCar({
      slug: "current",
      category: "Sedan",
      price: 100000,
    });
    const cars = [
      current,
      makeCar({ slug: "s-1", category: "Sedan", price: 100000 }),
    ];
    render(
      <DetailSimilarVehicles {...defaultProps} current={current} cars={cars} />,
    );
    // Verifica que o link interno do CarCard usa o siteSlug correto
    const card = screen.getByTestId("car-card-s-1");
    const link = within(card).getByTestId("car-card-s-1-link");
    expect(link).toHaveAttribute("href", "/sites/auto-fit/estoque/s-1");
    // Verifica que o link WhatsApp do CarCard contém o phone
    const whatsappLink = within(card).getByTestId("car-card-s-1-whatsapp");
    const href = whatsappLink.getAttribute("href") ?? "";
    expect(href).toContain("5511987654321");
  });
});
