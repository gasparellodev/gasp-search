import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { AboutMissionVision } from "@/components/sites/about/AboutMissionVision";

import { SITE_FIXTURE } from "../site-fixtures";

expect.extend(toHaveNoViolations);

describe("<AboutMissionVision />", () => {
  it("renderiza wrapper e 3 cards horizontais em desktop", () => {
    render(
      <AboutMissionVision
        variables={{
          mission: SITE_FIXTURE.mission,
          vision: SITE_FIXTURE.vision,
          values: SITE_FIXTURE.values,
        }}
      />,
    );

    expect(screen.getByTestId("about-mission-vision")).toHaveClass(
      "grid-cols-1",
      "md:grid-cols-3",
    );
    expect(screen.getByTestId("about-mission").tagName).toBe("ARTICLE");
    expect(screen.getByTestId("about-vision").tagName).toBe("ARTICLE");
    expect(screen.getByTestId("about-values").tagName).toBe("ARTICLE");
  });

  it("renderiza missão, visão e valores sem fallback hardcoded", () => {
    render(
      <AboutMissionVision
        variables={{
          mission: SITE_FIXTURE.mission,
          vision: SITE_FIXTURE.vision,
          values: SITE_FIXTURE.values,
        }}
      />,
    );

    expect(screen.getByText(SITE_FIXTURE.mission)).toBeInTheDocument();
    expect(screen.getByText(SITE_FIXTURE.vision)).toBeInTheDocument();
    for (const value of SITE_FIXTURE.values) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
  });

  it("renderiza 4 ou 8 itens conforme variables.values", () => {
    const fourValues = ["Transparência", "Garantia", "Agilidade", "Cuidado"];
    const eightValues = [
      "Transparência",
      "Garantia",
      "Agilidade",
      "Cuidado",
      "Procedência",
      "Respeito",
      "Excelência",
      "Clareza",
    ];

    const { rerender } = render(
      <AboutMissionVision
        variables={{
          mission: SITE_FIXTURE.mission,
          vision: SITE_FIXTURE.vision,
          values: fourValues,
        }}
      />,
    );
    expect(screen.getByTestId("about-values").querySelectorAll("li")).toHaveLength(4);

    rerender(
      <AboutMissionVision
        variables={{
          mission: SITE_FIXTURE.mission,
          vision: SITE_FIXTURE.vision,
          values: eightValues,
        }}
      />,
    );
    expect(screen.getByTestId("about-values").querySelectorAll("li")).toHaveLength(8);
  });

  it("não tem violações axe-core", async () => {
    const { container } = render(
      <AboutMissionVision
        variables={{
          mission: SITE_FIXTURE.mission,
          vision: SITE_FIXTURE.vision,
          values: SITE_FIXTURE.values,
        }}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
