import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { DetailFinancingCalcInline } from "@/components/sites/stock/DetailFinancingCalcInline";
import { DISCLAIMER_TEXT } from "@/lib/finance";

expect.extend(toHaveNoViolations);

const baseProps = {
  price: 119900,
  brand: "Toyota",
  model: "Corolla",
  whatsappPhone: "5581981000000",
  businessName: "Touring Cars",
  siteSlug: "touring-cars",
};

describe("<DetailFinancingCalcInline />", () => {
  it("renderiza expandido por padrão com preço pré-preenchido, entrada e prazo", () => {
    render(<DetailFinancingCalcInline {...baseProps} />);

    expect(screen.getByTestId("detail-financing-calculator-inline")).toBeInTheDocument();
    expect(screen.getByText("Simule seu financiamento")).toBeInTheDocument();
    expect(
      (screen.getByTestId("detail-financing-price") as HTMLInputElement).value,
    ).toMatch(/119/);
    expect(screen.getByTestId("detail-financing-down-display")).toHaveTextContent(
      "20%",
    );
    expect(screen.getByTestId("detail-financing-months-select")).toHaveValue("48");
    expect(screen.getByTestId("detail-financing-disclaimer")).toHaveTextContent(
      DISCLAIMER_TEXT,
    );
  });

  it("recalcula a parcela em tempo real ao alterar entrada e prazo", async () => {
    const user = userEvent.setup();
    render(<DetailFinancingCalcInline {...baseProps} />);

    const initialInstallment = screen.getByTestId(
      "detail-financing-installment",
    ).textContent;

    await user.selectOptions(screen.getByTestId("detail-financing-months-select"), "60");
    await user.tab();

    expect(screen.getByTestId("detail-financing-installment").textContent).not.toBe(
      initialInstallment,
    );

    const slider = screen.getByTestId("detail-financing-down-slider");
    fireEvent.change(slider, { target: { value: "40" } });

    expect(screen.getByTestId("detail-financing-down-display")).toHaveTextContent(
      "40%",
    );
  });

  it("gera CTA WhatsApp com template financing e utm_content da calculadora", () => {
    render(<DetailFinancingCalcInline {...baseProps} />);

    const href = screen
      .getByTestId("detail-financing-whatsapp")
      .getAttribute("href")!;
    expect(href).toContain("wa.me/5581981000000");
    expect(href).toContain("utm_campaign=financing");
    expect(href).toContain("utm_content=detail-financing-inline");
    expect(new URL(href).searchParams.get("text")).toContain("Toyota Corolla");
  });

  it("não tem violações axe-core", async () => {
    const { container } = render(<DetailFinancingCalcInline {...baseProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
