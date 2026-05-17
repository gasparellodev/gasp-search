import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { AboutTimeline } from "@/components/sites/about/AboutTimeline";

expect.extend(toHaveNoViolations);

const ENTRIES = [
  {
    year: 2015,
    title: "Fundação da empresa",
    description: "Começamos com 3 carros e muito sonho.",
  },
  {
    year: 2019,
    title: "Expansão para o segundo galpão",
    description: "Ampliamos nossa capacidade para 80 veículos.",
  },
  {
    year: 2024,
    title: "Mais de 1.000 carros vendidos",
    description: undefined,
  },
];

const BUSINESS_NAME = "Touring Cars";

describe("<AboutTimeline />", () => {
  it("renderiza <section> com aria-labelledby apontando para o heading quando entries presentes", () => {
    render(<AboutTimeline entries={ENTRIES} businessName={BUSINESS_NAME} />);
    const section = screen.getByRole("region", { name: /nossa história/i });
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute("aria-labelledby", "timeline-heading");
  });

  it("renderiza heading 'Nossa história'", () => {
    render(<AboutTimeline entries={ENTRIES} businessName={BUSINESS_NAME} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /nossa história/i }),
    ).toBeInTheDocument();
  });

  it("renderiza o ano e o título de cada entrada", () => {
    render(<AboutTimeline entries={ENTRIES} businessName={BUSINESS_NAME} />);
    for (const entry of ENTRIES) {
      expect(screen.getByText(String(entry.year))).toBeInTheDocument();
      expect(screen.getByText(entry.title)).toBeInTheDocument();
    }
  });

  it("renderiza description quando presente", () => {
    render(<AboutTimeline entries={ENTRIES} businessName={BUSINESS_NAME} />);
    expect(
      screen.getByText("Começamos com 3 carros e muito sonho."),
    ).toBeInTheDocument();
  });

  it("não renderiza description quando ausente (undefined)", () => {
    render(<AboutTimeline entries={ENTRIES} businessName={BUSINESS_NAME} />);
    // Last entry has no description — verify it doesn't break
    const allDescriptions = screen
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    const hasEmpty = allDescriptions.some((t) => t?.trim() === "");
    expect(hasEmpty).toBe(false);
  });

  it("retorna null quando entries está vazio", () => {
    const { container } = render(
      <AboutTimeline entries={[]} businessName={BUSINESS_NAME} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("possui atributo data-reveal na lista de entradas para choreography de motion", () => {
    render(<AboutTimeline entries={ENTRIES} businessName={BUSINESS_NAME} />);
    // At least one element with data-reveal should exist
    const revealed = document.querySelectorAll("[data-reveal]");
    expect(revealed.length).toBeGreaterThan(0);
  });

  it("não tem violações axe-core", async () => {
    const { container } = render(
      <AboutTimeline entries={ENTRIES} businessName={BUSINESS_NAME} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
