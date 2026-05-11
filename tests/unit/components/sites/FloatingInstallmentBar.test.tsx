import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FloatingInstallmentBar } from "@/components/sites/FloatingInstallmentBar";

import { SITE_FIXTURE } from "./site-fixtures";

expect.extend(toHaveNoViolations);

const SLUG = "j7k2p9-touring-cars";
const car = SITE_FIXTURE.cars[0]!;
const context = {
  businessName: SITE_FIXTURE.business_name,
  whatsapp: SITE_FIXTURE.whatsapp,
  car,
};

function mockDesktopMatch(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("<FloatingInstallmentBar />", () => {
  beforeEach(() => {
    mockDesktopMatch(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renderiza preço, parcela e CTA em viewport mobile", () => {
    render(
      <FloatingInstallmentBar
        slug={SLUG}
        carSlug={car.slug}
        initialContext={context}
      />,
    );

    const bar = screen.getByTestId("floating-installment-bar");
    expect(bar).toBeInTheDocument();
    expect(bar.className).toContain("fixed");
    expect(bar.className).toContain("z-[var(--z-installment-bar,45)]");
    expect(screen.getByText(/R\$\s?119\.900/)).toBeInTheDocument();
    expect(screen.getByText(/48x de R\$/)).toBeInTheDocument();
    expect(screen.getByText(/Toyota Corolla 2022/)).toBeInTheDocument();
  });

  it("desmonta em desktop, não apenas aplica classe lg:hidden", () => {
    mockDesktopMatch(true);

    render(
      <FloatingInstallmentBar
        slug={SLUG}
        carSlug={car.slug}
        initialContext={context}
      />,
    );

    expect(screen.queryByTestId("floating-installment-bar")).not.toBeInTheDocument();
  });

  it("injeta car context no link WhatsApp vehicle", () => {
    render(
      <FloatingInstallmentBar
        slug={SLUG}
        carSlug={car.slug}
        initialContext={context}
      />,
    );

    const link = screen.getByRole("link", {
      name: /falar no WhatsApp sobre Toyota Corolla 2022/i,
    });
    const href = link.getAttribute("href")!;
    expect(href).toContain("wa.me/5581981000000");
    expect(href).toContain("utm_campaign=vehicle");
    expect(href).toContain("utm_content=floating-cta");
    const url = new URL(href);
    const text = url.searchParams.get("text")!;
    expect(text).toContain("Toyota");
    expect(text).toContain("Corolla");
    expect(text).toContain("2022");
    expect(text).toContain("R$ 119.900");
  });

  it("mostra Sob consulta quando price é null e mantém CTA", () => {
    render(
      <FloatingInstallmentBar
        slug={SLUG}
        carSlug={car.slug}
        initialContext={{
          ...context,
          car: { ...car, price: null },
        }}
      />,
    );

    expect(screen.getByText("Sob consulta")).toBeInTheDocument();
    expect(screen.queryByText(/48x de R\$/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /falar no WhatsApp sobre Toyota Corolla 2022/i }),
    ).toHaveAttribute("href", expect.stringContaining("utm_campaign=vehicle"));
  });

  it("não tem violações axe-core", async () => {
    const { container } = render(
      <FloatingInstallmentBar
        slug={SLUG}
        carSlug={car.slug}
        initialContext={context}
      />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
