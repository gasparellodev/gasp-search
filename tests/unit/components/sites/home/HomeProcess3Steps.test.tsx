/**
 * Tests do <HomeProcess3Steps /> (issue #223 / Sprint 4 / H3).
 *
 * 3 cards horizontais (desktop) / stack vertical (mobile). Conteúdo
 * hardcoded em `lib/sites/process-steps-template.ts`.
 */
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { HomeProcess3Steps } from "@/components/sites/home/HomeProcess3Steps";
import { PROCESS_STEPS_TEMPLATE } from "@/lib/sites/process-steps-template";

expect.extend(toHaveNoViolations);

describe("<HomeProcess3Steps />", () => {
  it("renderiza section com aria-label", () => {
    render(<HomeProcess3Steps />);
    expect(
      screen.getByRole("region", { name: /como funciona/i }),
    ).toBeInTheDocument();
  });

  it("renderiza h2 'Comprar o seu próximo carro em 3 passos'", () => {
    render(<HomeProcess3Steps />);
    expect(
      screen.getByRole("heading", { level: 2, name: /em 3 passos/i }),
    ).toBeInTheDocument();
  });

  it("renderiza 3 cards (1 por step do template)", () => {
    render(<HomeProcess3Steps />);
    const items = screen.getByRole("list").querySelectorAll("li");
    expect(items).toHaveLength(3);
  });

  it("cada step tem h3 + body do template", () => {
    render(<HomeProcess3Steps />);
    for (const step of PROCESS_STEPS_TEMPLATE) {
      expect(
        screen.getByRole("heading", { level: 3, name: step.title }),
      ).toBeInTheDocument();
      expect(screen.getByText(step.body)).toBeInTheDocument();
    }
  });

  it("zero violations a11y (axe-core)", async () => {
    const { container } = render(<HomeProcess3Steps />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
