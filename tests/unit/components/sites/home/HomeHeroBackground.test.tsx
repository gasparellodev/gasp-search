/**
 * Tests do <HomeHeroBackground /> — camadas de bg do hero
 * (Hero Redesign Phase 7 — cinematic dark showroom).
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeHeroBackground } from "@/components/sites/home/HomeHeroBackground";

describe("<HomeHeroBackground />", () => {
  describe("Empty state (sem hero_image_url)", () => {
    it("renderiza camadas: cinematic + mesh + empty + pattern", () => {
      render(
        <HomeHeroBackground heroImageUrl={null} businessName="Auto Center" />,
      );
      expect(screen.getByTestId("home-hero-bg-cinematic")).toBeInTheDocument();
      expect(screen.getByTestId("home-hero-mesh")).toBeInTheDocument();
      expect(screen.getByTestId("home-hero-empty-state")).toBeInTheDocument();
      expect(screen.getByTestId("home-hero-pattern")).toBeInTheDocument();
    });

    it("NÃO renderiza <picture>/<img> quando sem URL", () => {
      render(
        <HomeHeroBackground heroImageUrl={null} businessName="Auto Center" />,
      );
      expect(screen.queryByTestId("home-hero-picture")).not.toBeInTheDocument();
      expect(
        screen.queryByAltText(/Hero — Auto Center/i),
      ).not.toBeInTheDocument();
    });

    it("trata string vazia como ausente", () => {
      render(
        <HomeHeroBackground heroImageUrl="" businessName="Auto Center" />,
      );
      expect(screen.getByTestId("home-hero-empty-state")).toBeInTheDocument();
      expect(screen.queryByTestId("home-hero-picture")).not.toBeInTheDocument();
    });
  });

  describe("Com hero_image_url", () => {
    it("renderiza <picture> + alt text com businessName", () => {
      render(
        <HomeHeroBackground
          heroImageUrl="https://cdn.example.com/hero.png"
          businessName="Auto Center"
        />,
      );
      const picture = screen.getByTestId("home-hero-picture");
      expect(picture).toBeInTheDocument();
      const img = picture.querySelector("img");
      expect(img?.getAttribute("alt")).toBe("Hero — Auto Center");
    });

    it("aplica hero-photo-grade (filter cinematic) na <img>", () => {
      render(
        <HomeHeroBackground
          heroImageUrl="https://cdn.example.com/hero.png"
          businessName="Auto Center"
        />,
      );
      const img = screen
        .getByTestId("home-hero-picture")
        .querySelector("img");
      expect(img?.className).toMatch(/hero-photo-grade/);
    });

    it("mantém camadas atmosphere mesmo com foto (mesh + pattern)", () => {
      render(
        <HomeHeroBackground
          heroImageUrl="https://cdn.example.com/hero.png"
          businessName="Auto Center"
        />,
      );
      expect(screen.getByTestId("home-hero-mesh")).toBeInTheDocument();
      expect(screen.getByTestId("home-hero-pattern")).toBeInTheDocument();
    });
  });
});
