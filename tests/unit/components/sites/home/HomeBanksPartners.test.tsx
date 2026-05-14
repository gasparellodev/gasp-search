/**
 * Tests do <HomeBanksPartners /> (issue #223 / Sprint 4 / H3).
 *
 * Wrapper Server Component sobre `<BanksStrip>` shared (#G2) com h2
 * editorial. Reuso da strip de bancos parceiros.
 */
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { HomeBanksPartners } from "@/components/sites/home/HomeBanksPartners";

expect.extend(toHaveNoViolations);

describe("<HomeBanksPartners />", () => {
  it("renderiza section com aria-label", () => {
    render(<HomeBanksPartners />);
    expect(
      screen.getByRole("region", { name: /bancos parceiros/i }),
    ).toBeInTheDocument();
  });

  it("renderiza h2 'Bancos parceiros para financiar seu próximo carro'", () => {
    render(<HomeBanksPartners />);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /bancos parceiros para financiar seu próximo carro/i,
      }),
    ).toBeInTheDocument();
  });

  it("reusa <BanksStrip> com SVGs locais", () => {
    render(<HomeBanksPartners />);
    // BanksStrip renderiza imagens dos bancos; checa pelo menos 1.
    const region = screen.getByRole("region", { name: /bancos parceiros/i });
    const banks = region.querySelectorAll("img");
    expect(banks.length).toBeGreaterThan(0);
  });

  it("tem id='bancos-parceiros' pra link âncora do HomeFinancingWidget (#299)", () => {
    render(<HomeBanksPartners />);
    const region = screen.getByRole("region", { name: /bancos parceiros/i });
    expect(region.id).toBe("bancos-parceiros");
  });

  it("zero violations a11y (axe-core)", async () => {
    const { container } = render(<HomeBanksPartners />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
