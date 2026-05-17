/**
 * Tests do <HomeHeroMonogram /> — SVG monogram watermark do hero
 * (Hero Redesign Phase 7 — cinematic dark showroom).
 */
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { HomeHeroMonogram } from "@/components/sites/home/HomeHeroMonogram";

expect.extend(toHaveNoViolations);

describe("<HomeHeroMonogram />", () => {
  it("renderiza variant corner com aria-hidden + SVG outline", () => {
    render(<HomeHeroMonogram businessName="Auto Center" />);
    const corner = screen.getByTestId("home-hero-monogram-corner");
    expect(corner).toBeInTheDocument();
    expect(corner.getAttribute("aria-hidden")).toBe("true");
    expect(corner.getAttribute("data-variant")).toBe("corner");
    const svg = corner.querySelector("svg");
    expect(svg).not.toBeNull();
    const text = corner.querySelector("text");
    expect(text?.getAttribute("fill")).toBe("none");
    expect(text?.getAttribute("stroke")).toBe("currentColor");
  });

  it("renderiza variant behind com escala maior que corner", () => {
    render(<HomeHeroMonogram businessName="Auto Center" variant="behind" />);
    const behind = screen.getByTestId("home-hero-monogram-behind");
    expect(behind).toBeInTheDocument();
    expect(behind.getAttribute("data-variant")).toBe("behind");
    const svg = behind.querySelector("svg");
    // behind usa h-[44vh] em md+ (anteriormente 80vh — Fix pass 1
    // reduziu pra evitar carimbo gigante sobre fotos claras).
    expect(svg?.getAttribute("class")).toMatch(/h-\[4[04]vh\]/);
  });

  it("extrai 2 iniciais de business name com 2+ palavras (Auto Center → AC)", () => {
    render(<HomeHeroMonogram businessName="Auto Center" />);
    const text = screen.getByTestId("home-hero-monogram-corner").querySelector("text");
    expect(text?.textContent).toBe("AC");
  });

  it("extrai 2 primeiras letras quando 1 palavra (Poliguara → PO)", () => {
    render(<HomeHeroMonogram businessName="Poliguara" />);
    const text = screen.getByTestId("home-hero-monogram-corner").querySelector("text");
    expect(text?.textContent).toBe("PO");
  });

  it("ignora stopwords PT-BR (Concessionária do João → CJ)", () => {
    render(<HomeHeroMonogram businessName="Concessionária do João" />);
    const text = screen.getByTestId("home-hero-monogram-corner").querySelector("text");
    expect(text?.textContent).toBe("CJ");
  });

  it("aplica .hero-monogram (mix-blend screen + opacity)", () => {
    render(<HomeHeroMonogram businessName="Auto Center" />);
    const corner = screen.getByTestId("home-hero-monogram-corner");
    expect(corner.className).toMatch(/hero-monogram/);
  });

  it("zero violações axe", async () => {
    const { container } = render(
      <HomeHeroMonogram businessName="Auto Center" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
