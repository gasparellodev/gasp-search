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
  address: SITE_FIXTURE.address,
  cars: SITE_FIXTURE.cars,
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

  describe("Empty state hero (WP1 #309 — graceful, glass card por cima)", () => {
    it("sem hero_image: aplica linear-gradient com primary_color (NÃO branco)", () => {
      render(<HomeHero {...baseProps} hero_image_url={null} />);
      const fallback = screen.getByTestId("home-hero-empty-state");
      expect(fallback).toBeInTheDocument();
      // O gradient agora é só fundo (sem monogram avulso — o card carrega
      // o branding via H1). Verifica a presença do background-image inline.
      const styleAttr = fallback.getAttribute("style") ?? "";
      expect(styleAttr).toMatch(/linear-gradient/i);
    });

    it("sem hero_image: NÃO renderiza <img>", () => {
      render(<HomeHero {...baseProps} hero_image_url={null} />);
      expect(
        screen.queryByAltText(`Hero — ${SITE_FIXTURE.business_name}`),
      ).not.toBeInTheDocument();
    });

    it("sem hero_image: glass card ainda renderiza (branding preservado)", () => {
      render(<HomeHero {...baseProps} hero_image_url={null} />);
      expect(screen.getByTestId("home-hero-card")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
  });

  describe("Layout fullscreen + glass card (WP1 #309)", () => {
    it("aplica min-h-[100dvh] no container (fullscreen, NÃO vh)", () => {
      render(<HomeHero {...baseProps} />);
      const container = screen.getByTestId("home-hero");
      expect(container.className).toMatch(/min-h-\[100dvh\]/);
    });

    it("renderiza glass card com backdrop-blur centro-baixo", () => {
      render(<HomeHero {...baseProps} />);
      const card = screen.getByTestId("home-hero-card");
      expect(card).toBeInTheDocument();
      expect(card.className).toMatch(/backdrop-blur/);
      // bg translúcido pra ler imagem por trás (≤95%)
      expect(card.className).toMatch(/bg-white\/(7[0-9]|8[0-9]|9[0-5])/);
    });

    it("H1 + AI passage + search bar todos dentro do glass card", () => {
      render(<HomeHero {...baseProps} />);
      const card = screen.getByTestId("home-hero-card");
      expect(card.contains(screen.getByRole("heading", { level: 1 }))).toBe(
        true,
      );
      expect(card.contains(screen.getByTestId("ai-citable-hero"))).toBe(true);
      expect(card.contains(screen.getByTestId("home-quick-search-bar"))).toBe(
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
