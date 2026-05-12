import { render, screen, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { DetailPriceBlock } from "@/components/sites/stock/DetailPriceBlock";
import { DISCLAIMER_TEXT } from "@/lib/finance";

import { SITE_FIXTURE } from "../site-fixtures";

expect.extend(toHaveNoViolations);

const car = SITE_FIXTURE.cars[0]!;
const baseVariables = {
  business_name: SITE_FIXTURE.business_name,
  business_slug: SITE_FIXTURE.business_slug,
  whatsapp: SITE_FIXTURE.whatsapp,
};

describe("<DetailPriceBlock />", () => {
  it("renderiza bloco sticky com preço, parcela, disclaimer, trust badges e CTAs", () => {
    render(<DetailPriceBlock variables={baseVariables} car={car} />);

    const block = screen.getByTestId("detail-price-block");
    expect(block.className).toContain("lg:sticky");
    expect(block.className).toContain("lg:top-24");
    expect(block.className).toContain("z-[var(--z-sticky-sidebar,30)]");

    expect(screen.getByTestId("detail-price-display")).toHaveTextContent(
      /R\$\s?119\.900/,
    );
    expect(screen.getByTestId("detail-price-installment")).toHaveTextContent(
      /48x de R\$/,
    );
    expect(screen.getByText(/Sujeito a aprovação de crédito/)).toBeInTheDocument();
    expect(screen.getByTestId("detail-financing-calculator-inline")).toBeInTheDocument();
    expect(screen.getByTestId("detail-financing-disclaimer")).toHaveTextContent(
      DISCLAIMER_TEXT,
    );

    const badges = screen.getByTestId("detail-trust-badges");
    expect(within(badges).getByText("Garantia 1 ano")).toBeInTheDocument();
    expect(within(badges).getByText("Vistoria completa")).toBeInTheDocument();
    expect(within(badges).getByText("IPVA pago")).toBeInTheDocument();
    expect(within(badges).getByText("Documento OK")).toBeInTheDocument();

    expect(screen.getByTestId("detail-cta-primary")).toBeInTheDocument();
    expect(screen.getByTestId("detail-cta-secondary")).toBeInTheDocument();
  });

  it("oculta parcela e calculadora quando preço é sob consulta", () => {
    render(
      <DetailPriceBlock
        variables={baseVariables}
        car={{ ...car, price: null }}
      />,
    );

    expect(screen.getByTestId("detail-price-consult")).toHaveTextContent(
      "Preço sob consulta",
    );
    expect(screen.queryByTestId("detail-price-display")).not.toBeInTheDocument();
    expect(screen.queryByTestId("detail-price-installment")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("detail-financing-calculator-inline"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("detail-cta-primary")).toHaveAttribute(
      "href",
      expect.stringContaining("utm_campaign=vehicle"),
    );
  });

  it("marca vendido e desabilita CTAs quando available=false", () => {
    render(
      <DetailPriceBlock
        variables={baseVariables}
        car={{ ...car, available: false }}
      />,
    );

    expect(screen.getByText("VENDIDO")).toBeInTheDocument();
    expect(screen.getByTestId("detail-cta-primary")).toBeDisabled();
    expect(screen.getByTestId("detail-cta-secondary")).toBeDisabled();
  });

  it("marca vendido e desabilita CTAs quando status=sold", () => {
    render(
      <DetailPriceBlock
        variables={baseVariables}
        car={{ ...car, status: "sold" }}
      />,
    );

    expect(screen.getByText("VENDIDO")).toBeInTheDocument();
    expect(screen.getByTestId("detail-cta-primary")).toBeDisabled();
  });

  it("não tem violações axe-core", async () => {
    const { container } = render(
      <DetailPriceBlock variables={baseVariables} car={car} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
