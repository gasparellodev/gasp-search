import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { SiteFAQ } from "@/components/sites/SiteFAQ";

expect.extend(toHaveNoViolations);

const ITEMS = [
  {
    question: "Como funciona o financiamento?",
    answer: "Simulamos com bancos parceiros e explicamos todas as condições.",
  },
  {
    question: "Os carros têm garantia?",
    answer: "Todos os carros passam por revisão e podem ter garantia adicional.",
  },
];

describe("<SiteFAQ />", () => {
  it("renderiza heading e perguntas como accordion", () => {
    render(<SiteFAQ title="Dúvidas frequentes" items={ITEMS} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Dúvidas frequentes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Como funciona o financiamento?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Os carros têm garantia?" }),
    ).toBeInTheDocument();
  });

  it("não emite JSON-LD FAQPage", () => {
    const { container } = render(<SiteFAQ title="FAQ" items={ITEMS} />);
    const scripts = container.querySelectorAll(
      'script[type="application/ld+json"]',
    );
    for (const script of scripts) {
      expect(script.textContent ?? "").not.toMatch(/FAQPage/);
    }
  });

  it("zero violations a11y", async () => {
    const { container } = render(<SiteFAQ title="FAQ" items={ITEMS} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
