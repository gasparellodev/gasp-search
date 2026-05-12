import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { AboutHeroEditorial } from "@/components/sites/about/AboutHeroEditorial";

import { SITE_FIXTURE } from "../site-fixtures";

expect.extend(toHaveNoViolations);

const variables = {
  about_text: SITE_FIXTURE.about_text,
  address: SITE_FIXTURE.address,
  brand_assets: SITE_FIXTURE.brand_assets,
  business_name: SITE_FIXTURE.business_name,
  slogan: SITE_FIXTURE.slogan,
};

describe("<AboutHeroEditorial />", () => {
  it("renderiza hero editorial com h1, tagline e primeiro parágrafo", () => {
    render(<AboutHeroEditorial variables={variables} manifestAboutUrl={null} />);

    expect(screen.getByTestId("about-hero-editorial")).toHaveClass(
      "min-h-[50dvh]",
      "md:min-h-[60dvh]",
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: `Sobre a ${SITE_FIXTURE.business_name}`,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(SITE_FIXTURE.slogan!)).toBeInTheDocument();
    expect(screen.getByText(SITE_FIXTURE.about_text)).toBeInTheDocument();
  });

  it("usa manifestAboutUrl com precedência sobre brand_assets.about_image_url", () => {
    render(
      <AboutHeroEditorial
        variables={variables}
        manifestAboutUrl="https://cdn.example.com/about-ai.png"
      />,
    );

    expect(screen.getByRole("img").getAttribute("src")).toBe(
      "https://cdn.example.com/about-ai.png",
    );
  });

  it("cai em brand_assets.about_image_url quando manifestAboutUrl é null", () => {
    render(<AboutHeroEditorial variables={variables} manifestAboutUrl={null} />);

    expect(screen.getByRole("img").getAttribute("src")).toBe(
      SITE_FIXTURE.brand_assets.about_image_url,
    );
  });

  it("cai no PNG estático quando manifest e brand_assets estão ausentes", () => {
    render(
      <AboutHeroEditorial
        variables={{
          ...variables,
          brand_assets: {
            ...variables.brand_assets,
            about_image_url: "",
          },
        }}
        manifestAboutUrl={null}
      />,
    );

    expect(screen.getByRole("img").getAttribute("src")).toBe(
      "/assets/about/porsche-model.png",
    );
  });

  it("usa fallback por cidade quando slogan está ausente", () => {
    render(
      <AboutHeroEditorial
        variables={{ ...variables, slogan: undefined }}
        manifestAboutUrl={null}
      />,
    );

    expect(
      screen.getByText("Concessionária de carros seminovos em Recife"),
    ).toBeInTheDocument();
  });

  it("não tem violações axe-core", async () => {
    const { container } = render(
      <AboutHeroEditorial variables={variables} manifestAboutUrl={null} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
