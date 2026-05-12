import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { AboutWarrantyDeepdive } from "@/components/sites/about/AboutWarrantyDeepdive";
import { WARRANTY_PROCESS } from "@/lib/sites/warranty-process";

expect.extend(toHaveNoViolations);

describe("<AboutWarrantyDeepdive />", () => {
  it("renderiza section #garantia com testid e offset de scroll", () => {
    render(<AboutWarrantyDeepdive />);
    const section = screen.getByTestId("about-warranty-deepdive");

    expect(section).toHaveAttribute("id", "garantia");
    expect(section).toHaveClass("scroll-mt-20", "md:scroll-mt-20");
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /garantia e pós-venda/i,
      }),
    ).toBeInTheDocument();
  });

  it("renderiza 3 cards processo como article com título e body", () => {
    render(<AboutWarrantyDeepdive />);

    const articles = screen
      .getByTestId("about-warranty-deepdive")
      .querySelectorAll("article");
    expect(articles).toHaveLength(3);

    for (const step of WARRANTY_PROCESS) {
      expect(
        screen.getByRole("heading", { level: 3, name: step.title }),
      ).toBeInTheDocument();
      expect(screen.getByText(step.body)).toBeInTheDocument();
    }
  });

  it("não tem violações axe-core", async () => {
    const { container } = render(<AboutWarrantyDeepdive />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
