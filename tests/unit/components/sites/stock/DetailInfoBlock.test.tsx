import { render, screen, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { DetailInfoBlock } from "@/components/sites/stock/DetailInfoBlock";

import { SITE_FIXTURE } from "../site-fixtures";

expect.extend(toHaveNoViolations);

describe("<DetailInfoBlock />", () => {
  it("renderiza título, frase AI-citable, badges e descrição escapada", () => {
    const car = {
      ...SITE_FIXTURE.cars[0]!,
      description: "<script>alert('xss')</script>\nSedan revisado.",
    };

    const { container } = render(
      <DetailInfoBlock
        variables={{
          business_name: SITE_FIXTURE.business_name,
          address: SITE_FIXTURE.address,
          cars: SITE_FIXTURE.cars,
          phone_display: SITE_FIXTURE.phone_display,
        }}
        car={car}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Corolla 2022",
    );
    expect(screen.getByTestId("ai-citable-hero")).toBeInTheDocument();

    const badges = screen.getByTestId("detail-info-badges");
    expect(within(badges).getByText("Toyota")).toBeInTheDocument();
    expect(within(badges).getByText("35.000 km")).toBeInTheDocument();
    expect(within(badges).getByText("CVT")).toBeInTheDocument();
    expect(within(badges).getByText("Flex")).toBeInTheDocument();
    expect(within(badges).getByText("Prata")).toBeInTheDocument();

    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByTestId("detail-info-description")).toHaveClass(
      "whitespace-pre-line",
    );
    expect(screen.getByText(/<script>alert\('xss'\)<\/script>/)).toBeInTheDocument();
  });

  it("não tem violações axe-core", async () => {
    const { container } = render(
      <DetailInfoBlock
        variables={{
          business_name: SITE_FIXTURE.business_name,
          address: SITE_FIXTURE.address,
          cars: SITE_FIXTURE.cars,
          phone_display: SITE_FIXTURE.phone_display,
        }}
        car={SITE_FIXTURE.cars[0]!}
      />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
