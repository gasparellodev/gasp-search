import { render, screen, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/actions/site-form", () => ({
  submitSiteForm: vi.fn(async () => ({ success: true })),
}));

import { CarDetailSection } from "@/components/sites/stock/CarDetailSection";

import { SITE_FIXTURE } from "../site-fixtures";

expect.extend(toHaveNoViolations);

const SLUG = "j7k2p9-touring-cars";
const SITE_ID = "44444444-4444-4444-8444-444444444444";

const baseVariables = {
  business_name: SITE_FIXTURE.business_name,
  business_slug: SITE_FIXTURE.business_slug,
  whatsapp: SITE_FIXTURE.whatsapp,
  phone_display: SITE_FIXTURE.phone_display,
  brand_assets: SITE_FIXTURE.brand_assets,
  // #214: AICitableHero consumes address + cars
  address: SITE_FIXTURE.address,
  cars: SITE_FIXTURE.cars,
};

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});

describe("<CarDetailSection /> — header", () => {
  it("renderiza <h1> com brand+model+year", () => {
    const car = SITE_FIXTURE.cars[0]!;
    render(
      <CarDetailSection
        variables={baseVariables}
        car={car}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent(car.model);
    expect(h1).toHaveTextContent(String(car.year));
  });

  it("renderiza breadcrumb apontando para estoque e marca filtrada", () => {
    const car = SITE_FIXTURE.cars[0]!;
    render(
      <CarDetailSection
        variables={baseVariables}
        car={car}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    expect(screen.getByRole("link", { name: "Estoque" })).toHaveAttribute(
      "href",
      `/sites/${SLUG}/estoque`,
    );
    expect(screen.getByRole("link", { name: car.brand })).toHaveAttribute(
      "href",
      `/sites/${SLUG}/estoque?m=Toyota`,
    );
    expect(screen.getByText(`${car.model} ${car.year}`)).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("<CarDetailSection /> — galeria", () => {
  it("renderiza <DetailGalleryCinema> com a primeira imagem da galeria", () => {
    const car = SITE_FIXTURE.cars[0]!;
    render(
      <CarDetailSection
        variables={baseVariables}
        car={car}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    expect(screen.getByTestId("detail-gallery-cinema")).toBeInTheDocument();
    expect(
      screen.getByAltText("Toyota Corolla 2022 - foto 1"),
    ).toBeInTheDocument();
  });
});

describe("<CarDetailSection /> — info", () => {
  it("renderiza badges (km, transmission, fuel, color)", () => {
    const car = SITE_FIXTURE.cars[0]!; // 35000 km, CVT, Flex, Prata
    render(
      <CarDetailSection
        variables={baseVariables}
        car={car}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    const badges = screen.getByTestId("detail-info-badges");
    expect(within(badges).getByText(/Toyota/)).toBeInTheDocument();
    expect(within(badges).getByText(/35\.000 km/)).toBeInTheDocument();
    expect(within(badges).getByText(/CVT/)).toBeInTheDocument();
    expect(within(badges).getByText(/Flex/)).toBeInTheDocument();
    expect(within(badges).getByText(/Prata/)).toBeInTheDocument();
  });

  it("renderiza price em BRL", () => {
    const car = SITE_FIXTURE.cars[0]!;
    render(
      <CarDetailSection
        variables={baseVariables}
        car={car}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    expect(screen.getByTestId("detail-price-display")).toHaveTextContent(
      /R\$\s?119\.900/,
    );
  });

  it("renderiza 'Sob consulta' quando price é null", () => {
    const car = { ...SITE_FIXTURE.cars[0]!, price: null };
    render(
      <CarDetailSection
        variables={baseVariables}
        car={car}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    expect(screen.getByTestId("detail-price-consult")).toHaveTextContent(
      "Preço sob consulta",
    );
  });
});

describe("<CarDetailSection /> — WhatsApp CTA", () => {
  it("href é wa.me/<digits>?text=<encoded>", () => {
    const car = SITE_FIXTURE.cars[0]!;
    render(
      <CarDetailSection
        variables={baseVariables}
        car={car}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    const cta = screen.getByTestId("detail-cta-primary");
    const href = cta.getAttribute("href")!;
    expect(href.startsWith("https://wa.me/5581981000000?text=")).toBe(true);

    // O text deve conter o nome decodificado.
    const url = new URL(href);
    const text = url.searchParams.get("text")!;
    expect(text).toContain("Toyota");
    expect(text).toContain("Corolla");
    expect(text).toContain("2022");
  });

  it("target=_blank + rel=noopener noreferrer (segurança)", () => {
    const car = SITE_FIXTURE.cars[0]!;
    render(
      <CarDetailSection
        variables={baseVariables}
        car={car}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    const cta = screen.getByTestId("detail-cta-primary");
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("aria-label descritivo (a11y)", () => {
    const car = SITE_FIXTURE.cars[0]!;
    render(
      <CarDetailSection
        variables={baseVariables}
        car={car}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    const cta = screen.getByTestId("detail-cta-primary");
    expect(cta).toHaveAttribute(
      "aria-label",
      `Falar no WhatsApp sobre ${car.brand} ${car.model} ${car.year}`,
    );
  });
});

describe("<CarDetailSection /> — descrição (XSS)", () => {
  it("renderiza description em <p whitespace-pre-line> (sem dangerouslySetInnerHTML)", () => {
    const car = {
      ...SITE_FIXTURE.cars[0]!,
      description: "Linha 1.\nLinha 2.\nLinha 3.",
    };
    render(
      <CarDetailSection
        variables={baseVariables}
        car={car}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    const desc = screen.getByTestId("detail-info-description");
    expect(desc).toHaveClass("whitespace-pre-line");
    expect(desc.textContent).toContain("Linha 1.");
    expect(desc.textContent).toContain("Linha 2.");
  });

  it("description com <script> é escapada (texto literal, sem execução)", () => {
    const car = {
      ...SITE_FIXTURE.cars[0]!,
      description: "<script>alert('xss')</script> e mais texto descritivo.",
    };
    const { container } = render(
      <CarDetailSection
        variables={baseVariables}
        car={car}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(
      screen.getByText(/<script>alert\('xss'\)<\/script>/),
    ).toBeInTheDocument();
  });
});

describe("<CarDetailSection /> — datasheet", () => {
  it("renderiza <dl> com cada [label, value] da car.datasheet[]", () => {
    const car = {
      ...SITE_FIXTURE.cars[0]!,
      datasheet: [
        ["Motor", "2.0 16v"],
        ["Câmbio", "CVT"],
        ["Combustível", "Flex"],
      ] as Array<[string, string]>,
    };
    render(
      <CarDetailSection
        variables={baseVariables}
        car={car}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    const dl = screen.getByTestId("detail-spec-grid");
    expect(within(dl).getByText("Motor")).toBeInTheDocument();
    expect(within(dl).getByText("2.0 16v")).toBeInTheDocument();
    expect(within(dl).getByText("Câmbio")).toBeInTheDocument();
    expect(within(dl).getByText("CVT")).toBeInTheDocument();
    expect(within(dl).getByText("Combustível")).toBeInTheDocument();
  });

  it("mantém ficha técnica top-level quando datasheet está vazio", () => {
    const car = { ...SITE_FIXTURE.cars[0]!, datasheet: [] };
    render(
      <CarDetailSection
        variables={baseVariables}
        car={car}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    const grid = screen.getByTestId("detail-spec-grid");
    expect(within(grid).getByText("Marca")).toBeInTheDocument();
    expect(within(grid).getByText("Toyota")).toBeInTheDocument();
    expect(screen.getAllByTestId("detail-spec-item")).toHaveLength(8);
  });
});

describe("<CarDetailSection /> — form inline", () => {
  it("renderiza SiteForm com variant=car-detail e prefillModel", () => {
    const car = SITE_FIXTURE.cars[0]!;
    render(
      <CarDetailSection
        variables={baseVariables}
        car={car}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    const form = screen.getByTestId("site-form");
    expect(form).toHaveAttribute("data-variant", "car-detail");

    const modelInput = form.querySelector(
      'input[type="text"]',
    ) as HTMLInputElement | null;
    expect(modelInput?.value).toBe(`${car.brand} ${car.model}`);
    expect(modelInput?.readOnly).toBe(true);
  });
});

describe("<CarDetailSection /> — a11y runtime", () => {
  it("não tem violações axe-core (a11y runtime)", async () => {
    const car = SITE_FIXTURE.cars[0]!;
    const { container } = render(
      <CarDetailSection
        variables={baseVariables}
        car={car}
        siteId={SITE_ID}
        slug={SLUG}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
