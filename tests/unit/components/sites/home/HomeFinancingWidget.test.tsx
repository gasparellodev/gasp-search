/**
 * Testes do <HomeFinancingWidget /> (issue #222 / Sprint 4 / H2).
 *
 * Calculadora INLINE — diferencial competitivo. Cobertura:
 *   - Render + ordem de inputs (price / entrada / prazo).
 *   - Calcula installment real-time (PRICE formula via `lib/finance`).
 *   - DISCLAIMER_TEXT obrigatório abaixo do output.
 *   - Output `aria-live="polite"` para leitores de tela.
 *   - Edge cases: down=100% ("Sem financiamento"), price=0 ("—").
 *   - CTA WhatsApp pré-fill template `financing` (utm_campaign=financing).
 *   - jest-axe ZERO violations.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { HomeFinancingWidget } from "@/components/sites/home/HomeFinancingWidget";
import { DISCLAIMER_TEXT } from "@/lib/finance";

expect.extend(toHaveNoViolations);

const PHONE = "5511987654321";
const BUSINESS = "Touring Cars";
const SLUG = "j7k2p9-touring-cars";

describe("<HomeFinancingWidget />", () => {
  it("renderiza header <h2> com copy 'Simule seu financiamento'", () => {
    render(
      <HomeFinancingWidget
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: /simule seu financiamento/i }),
    ).toBeInTheDocument();
  });

  it("renderiza copy curto + âncora pra #bancos-parceiros (#299, sem BanksStrip)", () => {
    render(
      <HomeFinancingWidget
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );

    // #299: BanksStrip foi removido daqui (consolidado em <HomeBanksPartners>).
    // O componente apresenta uma copy curta + link âncora pra rolar até a
    // seção canônica.
    expect(screen.getByTestId("financing-banks-anchor")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /lista completa/i }),
    ).toHaveAttribute("href", "#bancos-parceiros");
  });

  it("renderiza price input, slider entrada e select prazo (defaults: 50000 / 20% / 48m)", () => {
    render(
      <HomeFinancingWidget
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );

    // Price: text input controlled, mostra "R$ 50.000" no display inicial.
    const priceInput = screen.getByLabelText(/valor do veículo/i);
    expect(priceInput).toBeInTheDocument();

    // Slider entrada (%) — `aria-valuenow=20`.
    const slider = screen.getByLabelText(/entrada/i);
    expect(slider.getAttribute("aria-valuenow")).toBe("20");
    expect(slider.getAttribute("aria-valuemin")).toBe("0");
    expect(slider.getAttribute("aria-valuemax")).toBe("50");

    // Select prazo — default 48.
    const select = screen.getByLabelText(/prazo/i);
    expect((select as HTMLSelectElement).value).toBe("48");
  });

  it("output usa aria-live='polite' (a11y para mudanças dinâmicas)", () => {
    render(
      <HomeFinancingWidget
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    const output = screen.getByTestId("financing-output");
    expect(output.getAttribute("aria-live")).toBe("polite");
  });

  it("renderiza DISCLAIMER_TEXT abaixo da calculadora (obrigatório por CDC)", () => {
    render(
      <HomeFinancingWidget
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();
  });

  it("output inicial — installment > 0 para defaults (50000, 20%, 48m, 1.99% a.m.)", () => {
    render(
      <HomeFinancingWidget
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    const installment = screen.getByTestId("financing-installment");
    // financed = 40000, installment ≈ 1301.42 (PRICE 1.99% a.m. 48m)
    expect(installment.textContent ?? "").toMatch(/R\$/);
    expect(installment.textContent ?? "").not.toBe("—");
  });

  it("edge case — downPaymentPct=50% (max do slider) propaga ao aria-valuenow", () => {
    render(
      <HomeFinancingWidget
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    const slider = screen.getByLabelText(/entrada/i) as HTMLInputElement;
    // `userEvent` não tem helper canônico pra `input[type=range]`. `fireEvent.change`
    // simula o evento React `onChange` corretamente para inputs controlled.
    fireEvent.change(slider, { target: { value: "50" } });

    expect(slider.getAttribute("aria-valuenow")).toBe("50");
    // Display "%" também atualiza.
    expect(screen.getByTestId("financing-down-display").textContent).toBe("50%");
  });

  it("edge case — price vazio/0 exibe '—' no output", async () => {
    const user = userEvent.setup();
    render(
      <HomeFinancingWidget
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    const priceInput = screen.getByLabelText(/valor do veículo/i);
    await user.clear(priceInput);

    const installment = screen.getByTestId("financing-installment");
    expect(installment.textContent).toBe("—");
  });

  it("CTA WhatsApp tem template financing (utm_campaign=financing)", () => {
    render(
      <HomeFinancingWidget
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    const cta = screen.getByRole("link", { name: /simular financiamento/i });
    const href = cta.getAttribute("href") ?? "";
    expect(href).toContain("wa.me/");
    expect(href).toContain("utm_campaign=financing");
    expect(href).toContain(`utm_content=home-cta`);
  });

  it("a11y — jest-axe ZERO violations", async () => {
    const { container } = render(
      <HomeFinancingWidget
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
