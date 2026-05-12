import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { DetailCtaStack } from "@/components/sites/stock/DetailCtaStack";

import { SITE_FIXTURE } from "../site-fixtures";

expect.extend(toHaveNoViolations);

const car = SITE_FIXTURE.cars[0]!;
const baseProps = {
  car,
  whatsappPhone: SITE_FIXTURE.whatsapp,
  businessName: SITE_FIXTURE.business_name,
  siteSlug: "touring-cars",
};

describe("<DetailCtaStack />", () => {
  it("renderiza dois CTAs fullwidth com template vehicle e componentes distintos", () => {
    render(<DetailCtaStack {...baseProps} />);

    const primary = screen.getByTestId("detail-cta-primary");
    const secondary = screen.getByTestId("detail-cta-secondary");

    expect(primary).toHaveTextContent("Falar no WhatsApp");
    expect(secondary).toHaveTextContent("Agendar test-drive");
    expect(primary).toHaveAttribute("href", expect.stringContaining("utm_campaign=vehicle"));
    expect(primary).toHaveAttribute(
      "href",
      expect.stringContaining("utm_content=detail-cta-primary"),
    );
    expect(secondary).toHaveAttribute(
      "href",
      expect.stringContaining("utm_content=detail-cta-secondary"),
    );
  });

  it("usa o mesmo texto canônico vehicle para o CTA secundário", () => {
    render(<DetailCtaStack {...baseProps} />);

    const primaryText = new URL(
      screen.getByTestId("detail-cta-primary").getAttribute("href")!,
    ).searchParams.get("text");
    const secondaryText = new URL(
      screen.getByTestId("detail-cta-secondary").getAttribute("href")!,
    ).searchParams.get("text");

    expect(secondaryText).toBe(primaryText);
    expect(secondaryText).toContain("Ainda está disponível?");
  });

  it("desabilita ambos CTAs para carro vendido", () => {
    render(<DetailCtaStack {...baseProps} unavailable />);

    expect(screen.getByTestId("detail-cta-primary")).toBeDisabled();
    expect(screen.getByTestId("detail-cta-secondary")).toBeDisabled();
    expect(screen.getAllByTitle("Veja carros similares")).toHaveLength(2);
  });

  it("não tem violações axe-core", async () => {
    const { container } = render(<DetailCtaStack {...baseProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
