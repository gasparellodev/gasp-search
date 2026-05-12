/**
 * Unit tests — `<DetailFaqVehicle>` (Phase 7 / Sprint 6 / #D3 — issue
 * #228).
 *
 * Smoke wrapper sobre `<SiteFAQ>` shared + `buildDetailFaqItems`. Defesa
 * primária do conteúdo está em `tests/unit/lib/sites/detail-faq-templates.test.ts`
 * (snapshot + interpolação). Aqui testamos só o wiring.
 */
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { DetailFaqVehicle } from "@/components/sites/stock/DetailFaqVehicle";

expect.extend(toHaveNoViolations);

describe("<DetailFaqVehicle>", () => {
  const car = {
    brand: "Toyota",
    model: "Corolla XEi",
    year: 2022,
  };

  it("renderiza title 'Perguntas frequentes'", () => {
    render(<DetailFaqVehicle car={car} />);
    expect(
      screen.getByRole("heading", { name: /perguntas frequentes/i }),
    ).toBeInTheDocument();
  });

  it("interpola brand/model/year nas perguntas", () => {
    render(<DetailFaqVehicle car={car} />);
    // Pelo menos uma pergunta deve mencionar a marca + modelo
    const triggers = screen.getAllByRole("button");
    const allLabels = triggers.map((t) => t.textContent ?? "").join(" ");
    expect(allLabels).toContain("Toyota");
    expect(allLabels).toContain("Corolla XEi");
    expect(allLabels).toContain("2022");
  });

  it("tem data-testid='detail-faq-vehicle' no root", () => {
    const { container } = render(<DetailFaqVehicle car={car} />);
    expect(
      container.querySelector("[data-testid='detail-faq-vehicle']"),
    ).not.toBeNull();
  });

  it("não tem violações axe-core críticas/sérias", async () => {
    const { container } = render(<DetailFaqVehicle car={car} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
