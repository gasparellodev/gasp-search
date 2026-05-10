import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeForm } from "@/components/sites/home/HomeForm";

import { SITE_FIXTURE } from "../site-fixtures";

const SITE_ID = "33333333-3333-4333-8333-333333333333";
const SLUG = "j7k2p9-touring-cars";

describe("<HomeForm />", () => {
  it("renderiza o título PT-BR fixo da Home", () => {
    render(
      <HomeForm
        siteId={SITE_ID}
        slug={SLUG}
        primary_color={SITE_FIXTURE.brand_assets.primary_color}
        text_on_primary={SITE_FIXTURE.brand_assets.text_on_primary}
      />,
    );
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /você está procurando.*algum modelo em específico/i,
      }),
    ).toBeInTheDocument();
  });

  it("delega ao SiteForm com variant='home'", () => {
    render(
      <HomeForm
        siteId={SITE_ID}
        slug={SLUG}
        primary_color={SITE_FIXTURE.brand_assets.primary_color}
        text_on_primary={SITE_FIXTURE.brand_assets.text_on_primary}
      />,
    );
    const form = screen.getByTestId("site-form");
    expect(form).toHaveAttribute("data-variant", "home");
  });
});
