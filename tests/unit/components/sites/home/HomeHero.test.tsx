import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeHero } from "@/components/sites/home/HomeHero";
import { SITE_ASSETS } from "@/lib/sites/site-assets";
// SITE_ASSETS importado pra checar fallback do demo cutout abaixo

import { SITE_FIXTURE } from "../site-fixtures";

const SLUG = "j7k2p9-touring-cars";

const baseProps = {
  business_name: SITE_FIXTURE.business_name,
  slogan: SITE_FIXTURE.slogan ?? SITE_FIXTURE.business_name,
  hero_image_url: SITE_FIXTURE.brand_assets.hero_image_url,
  primary_color: SITE_FIXTURE.brand_assets.primary_color,
  text_on_primary: SITE_FIXTURE.brand_assets.text_on_primary,
  slug: SLUG,
};

describe("<HomeHero />", () => {
  it("renderiza o slogan dentro de um <h1> em texto preto/foreground (light hero)", () => {
    render(<HomeHero {...baseProps} />);
    const h1 = screen.getByRole("heading", { level: 1, name: /Qualidade/ });
    expect(h1).toBeInTheDocument();
    expect(h1).toHaveClass("text-foreground");
  });

  it("renderiza CTA com link `/sites/[slug]/estoque`", () => {
    render(<HomeHero {...baseProps} />);
    const cta = screen.getByRole("link", { name: /estoque/i });
    expect(cta).toHaveAttribute("href", `/sites/${SLUG}/estoque`);
  });

  it("aplica primary_color no CTA via style inline (sanitizado)", () => {
    render(<HomeHero {...baseProps} />);
    const cta = screen.getByRole("link", { name: /estoque/i });
    expect(cta).toHaveStyle({
      backgroundColor: SITE_FIXTURE.brand_assets.primary_color,
      color: SITE_FIXTURE.brand_assets.text_on_primary,
    });
  });

  it("renderiza imagem hero com alt descritivo", () => {
    render(<HomeHero {...baseProps} />);
    const img = screen.getByAltText(`Hero — ${SITE_FIXTURE.business_name}`);
    expect(img).toBeInTheDocument();
  });

  it("usa `hero_image_url` quando fornecido", () => {
    render(<HomeHero {...baseProps} />);
    const img = screen.getByAltText(`Hero — ${SITE_FIXTURE.business_name}`);
    expect(img.getAttribute("src")).toBe(SITE_FIXTURE.brand_assets.hero_image_url);
  });

  it("cai no demo cutout quando `hero_image_url` é null", () => {
    render(<HomeHero {...baseProps} hero_image_url={null} />);
    const img = screen.getByAltText(`Hero — ${SITE_FIXTURE.business_name}`);
    expect(img.getAttribute("src")).toBe(SITE_ASSETS.hero.demoCarCutout);
  });

  it("renderiza container com fundo branco (`bg-background`) — hero light Figma-fiel", () => {
    render(<HomeHero {...baseProps} />);
    const container = screen.getByTestId("home-hero");
    expect(container).toHaveClass("bg-background");
  });

  it("renderiza chevron-down decorativo abaixo do hero (aria-hidden)", () => {
    render(<HomeHero {...baseProps} />);
    const cue = screen.getByTestId("home-hero-scroll-cue");
    expect(cue).toBeInTheDocument();
    expect(cue).toHaveAttribute("aria-hidden");
  });

  it("sanitiza cores adversariais no CTA (cai no fallback)", () => {
    render(
      <HomeHero
        {...baseProps}
        primary_color={"red; background: url(x);" as unknown as `#${string}`}
      />,
    );
    const cta = screen.getByRole("link", { name: /estoque/i });
    expect(cta).toHaveStyle({ backgroundColor: "#0C0C0C" });
  });
});
