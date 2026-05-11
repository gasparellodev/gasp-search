/**
 * Tests do <HomeFAQSection /> (issue #223 / Sprint 4 / H3).
 *
 * Radix Accordion 7-10 perguntas. SEM JSON-LD FAQPage (anti-pattern).
 * Client Component.
 */
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { HomeFAQSection } from "@/components/sites/home/HomeFAQSection";
import { FAQ_TEMPLATE } from "@/lib/sites/faq-template";

expect.extend(toHaveNoViolations);

describe("<HomeFAQSection />", () => {
  it("renderiza section com aria-label", () => {
    render(<HomeFAQSection />);
    expect(
      screen.getByRole("region", { name: /perguntas frequentes/i }),
    ).toBeInTheDocument();
  });

  it("renderiza h2 'Perguntas frequentes'", () => {
    render(<HomeFAQSection />);
    expect(
      screen.getByRole("heading", { level: 2, name: /perguntas frequentes/i }),
    ).toBeInTheDocument();
  });

  it("renderiza todas as perguntas do template como botões de accordion", () => {
    render(<HomeFAQSection />);
    for (const entry of FAQ_TEMPLATE) {
      // Cada question é Trigger (button)
      expect(
        screen.getByRole("button", { name: entry.question }),
      ).toBeInTheDocument();
    }
  });

  it("renderiza pelo menos 7 perguntas (range PO refinement)", () => {
    render(<HomeFAQSection />);
    const buttons = screen
      .getByRole("region", { name: /perguntas frequentes/i })
      .querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(7);
  });

  it("não emite JSON-LD FAQPage (anti-pattern DESIGN.md)", () => {
    const { container } = render(<HomeFAQSection />);
    const scripts = container.querySelectorAll(
      'script[type="application/ld+json"]',
    );
    for (const s of scripts) {
      const text = s.textContent ?? "";
      expect(text).not.toMatch(/FAQPage/);
    }
  });

  it("zero violations a11y (axe-core)", async () => {
    const { container } = render(<HomeFAQSection />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
