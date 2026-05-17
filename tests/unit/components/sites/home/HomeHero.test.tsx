import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { HomeHero } from "@/components/sites/home/HomeHero";

import { SITE_FIXTURE } from "../site-fixtures";

expect.extend(toHaveNoViolations);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const SLUG = "j7k2p9-touring-cars";

const baseProps = {
  business_name: SITE_FIXTURE.business_name,
  hero_image_url: SITE_FIXTURE.brand_assets.hero_image_url,
  primary_color: SITE_FIXTURE.brand_assets.primary_color,
  text_on_primary: SITE_FIXTURE.brand_assets.text_on_primary,
  slug: SLUG,
  // #214: AICitableHero injected inside HomeHero needs address + cars
  // #G4: phone_display added for microdata <address> block
  address: SITE_FIXTURE.address,
  cars: SITE_FIXTURE.cars,
  phone_display: SITE_FIXTURE.phone_display,
};

describe("<HomeHero />", () => {
  describe("H1 PT-BR canon (PO refinement #221)", () => {
    it("renderiza `<h1>` único `${business_name} — Carros seminovos em ${city}`", () => {
      render(<HomeHero {...baseProps} />);
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toBeInTheDocument();
      expect(h1.textContent).toBe(
        `${SITE_FIXTURE.business_name} — Carros seminovos em ${SITE_FIXTURE.address!.city}`,
      );
    });

    it("fallback gracioso quando address é null (sem 'em <city>')", () => {
      render(<HomeHero {...baseProps} address={null} />);
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1.textContent).toBe(
        `${SITE_FIXTURE.business_name} — Carros seminovos`,
      );
    });
  });

  describe("Image priority + LCP", () => {
    it("renderiza imagem hero com alt descritivo + priority (fetchpriority='high')", () => {
      render(<HomeHero {...baseProps} />);
      const img = screen.getByAltText(`Hero — ${SITE_FIXTURE.business_name}`);
      expect(img).toBeInTheDocument();
      // next/image priority injeta fetchpriority="high" no DOM final.
      // O `sizes="100vw"` é gravado no source mas next/image só emite o
      // atributo final quando há srcset (`unoptimized` suprime srcset → sizes
      // não aparece no DOM). LCP comportamento preservado via priority+fetchPriority.
      expect(img.getAttribute("fetchpriority")).toBe("high");
    });

    it("usa `hero_image_url` quando fornecido", () => {
      render(<HomeHero {...baseProps} />);
      const img = screen.getByAltText(`Hero — ${SITE_FIXTURE.business_name}`);
      expect(img.getAttribute("src")).toBe(
        SITE_FIXTURE.brand_assets.hero_image_url,
      );
    });
  });

  describe("Empty state hero (Hero Redesign — cinematic dark self-contained)", () => {
    it("sem hero_image: renderiza camadas cinematic dark + mesh + pattern (sem foto)", () => {
      render(<HomeHero {...baseProps} hero_image_url={null} />);
      // 5 camadas de bg: cinematic + mesh + empty-state placeholder + pattern.
      expect(screen.getByTestId("home-hero-bg-cinematic")).toBeInTheDocument();
      expect(screen.getByTestId("home-hero-mesh")).toBeInTheDocument();
      expect(screen.getByTestId("home-hero-empty-state")).toBeInTheDocument();
      expect(screen.getByTestId("home-hero-pattern")).toBeInTheDocument();
    });

    it("sem hero_image: NÃO renderiza <img>", () => {
      render(<HomeHero {...baseProps} hero_image_url={null} />);
      expect(
        screen.queryByAltText(`Hero — ${SITE_FIXTURE.business_name}`),
      ).not.toBeInTheDocument();
    });

    it("sem hero_image: lockup ainda renderiza (branding preservado via H1 + monogram)", () => {
      render(<HomeHero {...baseProps} hero_image_url={null} />);
      expect(screen.getByTestId("home-hero-lockup")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
      // SVG monograms (corner mobile + behind desktop) sempre presentes.
      expect(
        screen.getByTestId("home-hero-monogram-corner"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("home-hero-monogram-behind"),
      ).toBeInTheDocument();
    });
  });

  describe("Layout fullscreen + cinematic dark (Hero Redesign)", () => {
    it("aplica min-h-[100dvh] no container (fullscreen, NÃO vh)", () => {
      render(<HomeHero {...baseProps} />);
      const container = screen.getByTestId("home-hero");
      expect(container.className).toMatch(/min-h-\[100dvh\]/);
    });

    it("renderiza monogram watermark (corner + behind) com aria-hidden", () => {
      render(<HomeHero {...baseProps} />);
      const corner = screen.getByTestId("home-hero-monogram-corner");
      const behind = screen.getByTestId("home-hero-monogram-behind");
      expect(corner.getAttribute("aria-hidden")).toBe("true");
      expect(behind.getAttribute("aria-hidden")).toBe("true");
      expect(corner.className).toMatch(/hero-monogram/);
      expect(behind.className).toMatch(/hero-monogram/);
    });

    it("H1 + AI passage + search bar todos dentro do lockup", () => {
      render(<HomeHero {...baseProps} />);
      const lockup = screen.getByTestId("home-hero-lockup");
      expect(lockup.contains(screen.getByRole("heading", { level: 1 }))).toBe(
        true,
      );
      expect(lockup.contains(screen.getByTestId("ai-citable-hero"))).toBe(true);
      expect(lockup.contains(screen.getByTestId("home-quick-search-bar"))).toBe(
        true,
      );
    });
  });

  describe("Quick search bar embed", () => {
    it("embute <HomeQuickSearchBar> dentro do hero", () => {
      render(<HomeHero {...baseProps} />);
      expect(screen.getByTestId("home-quick-search-bar")).toBeInTheDocument();
      // 3 inputs presentes
      expect(screen.getByLabelText(/marca/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/modelo/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/preço.*máx/i)).toBeInTheDocument();
    });
  });

  describe("AICitableHero injection (#214)", () => {
    it("injeta AI passage-citable após o h1", () => {
      render(<HomeHero {...baseProps} />);
      expect(screen.getByTestId("ai-citable-hero")).toBeInTheDocument();
    });
  });

  it("zero violations a11y (axe-core)", async () => {
    const { container } = render(<HomeHero {...baseProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("zero violations a11y (axe-core) no empty state", async () => {
    const { container } = render(
      <HomeHero {...baseProps} hero_image_url={null} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
