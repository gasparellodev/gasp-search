import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SitePage } from "@/components/sites/SitePage";

import { SITE_FIXTURE } from "./site-fixtures";

const SITE_ID = "33333333-3333-4333-8333-333333333333";
const SLUG = "j7k2p9-touring-cars";

describe("<SitePage />", () => {
  it("renderiza slogan num <h1> (HomeHero)", () => {
    render(<SitePage variables={SITE_FIXTURE} siteId={SITE_ID} slug={SLUG} />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: SITE_FIXTURE.slogan,
      }),
    ).toBeInTheDocument();
  });

  it("compõe as 5 seções da Home (Hero, Categories, Form, Emphasis, RecentSales)", () => {
    render(<SitePage variables={SITE_FIXTURE} siteId={SITE_ID} slug={SLUG} />);
    expect(screen.getByTestId("home-hero")).toBeInTheDocument();
    expect(screen.getByTestId("home-categories")).toBeInTheDocument();
    expect(screen.getByTestId("home-form")).toBeInTheDocument();
    expect(screen.getByTestId("home-emphasis")).toBeInTheDocument();
    expect(screen.getByTestId("home-recent-sales")).toBeInTheDocument();
  });

  it("renderiza <SiteHeader> e <SiteFooter>", () => {
    render(<SitePage variables={SITE_FIXTURE} siteId={SITE_ID} slug={SLUG} />);
    expect(screen.getByTestId("site-header")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("CTA do Hero linka para `/sites/[slug]/estoque`", () => {
    render(<SitePage variables={SITE_FIXTURE} siteId={SITE_ID} slug={SLUG} />);
    const cta = screen.getByTestId("home-hero-cta");
    expect(cta).toHaveAttribute("href", `/sites/${SLUG}/estoque`);
  });

  it("aplica CSS vars --site-primary e --site-text-on-primary no wrapper", () => {
    const { container } = render(
      <SitePage variables={SITE_FIXTURE} siteId={SITE_ID} slug={SLUG} />,
    );
    const wrapper = container.querySelector<HTMLElement>(".site-page");
    expect(wrapper).not.toBeNull();
    expect(
      wrapper!.style.getPropertyValue("--site-primary"),
    ).toBe(SITE_FIXTURE.primary_color);
    expect(
      wrapper!.style.getPropertyValue("--site-text-on-primary"),
    ).toBe(SITE_FIXTURE.text_on_primary);
  });

  it("expõe `data-site-id` igual ao siteId recebido (contrato pra E2E)", () => {
    const { container } = render(
      <SitePage variables={SITE_FIXTURE} siteId={SITE_ID} slug={SLUG} />,
    );
    const wrapper = container.querySelector<HTMLElement>("[data-site-id]");
    expect(wrapper?.getAttribute("data-site-id")).toBe(SITE_ID);
  });

  it("sanitiza cores via sanitizeHex — input adversarial vira fallback", () => {
    const adversarial = {
      ...SITE_FIXTURE,
      primary_color: "red; background: url(x);" as unknown as `#${string}`,
    };
    const { container } = render(
      <SitePage variables={adversarial} siteId={SITE_ID} slug={SLUG} />,
    );
    const wrapper = container.querySelector<HTMLElement>(".site-page");
    expect(wrapper).not.toBeNull();
    expect(
      wrapper!.style.getPropertyValue("--site-primary"),
    ).toBe("#0C0C0C");
  });
});
