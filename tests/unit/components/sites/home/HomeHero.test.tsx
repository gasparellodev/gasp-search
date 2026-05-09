import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeHero } from "@/components/sites/home/HomeHero";

import { SITE_FIXTURE } from "../site-fixtures";

const SLUG = "j7k2p9-touring-cars";

const baseProps = {
  business_name: SITE_FIXTURE.business_name,
  slogan: SITE_FIXTURE.slogan,
  hero_image_url: SITE_FIXTURE.hero_image_url,
  primary_color: SITE_FIXTURE.primary_color,
  text_on_primary: SITE_FIXTURE.text_on_primary,
  slug: SLUG,
};

describe("<HomeHero />", () => {
  it("renderiza o slogan dentro de um <h1>", () => {
    render(<HomeHero {...baseProps} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Qualidade/ }),
    ).toBeInTheDocument();
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
      backgroundColor: SITE_FIXTURE.primary_color,
      color: SITE_FIXTURE.text_on_primary,
    });
  });

  it("renderiza imagem hero com alt descritivo", () => {
    render(<HomeHero {...baseProps} />);
    const img = screen.getByAltText(`Hero — ${SITE_FIXTURE.business_name}`);
    expect(img).toBeInTheDocument();
  });

  it("sanitiza cores adversariais no CTA (cai no fallback)", () => {
    render(
      <HomeHero
        {...baseProps}
        primary_color={"red; background: url(x);" as unknown as `#${string}`}
      />,
    );
    const cta = screen.getByRole("link", { name: /estoque/i });
    // sanitizeHex retorna #0C0C0C quando inválido
    expect(cta).toHaveStyle({ backgroundColor: "#0C0C0C" });
  });
});
