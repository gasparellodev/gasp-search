import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SitePage } from "@/components/sites/SitePage";

import { SITE_FIXTURE } from "./site-fixtures";

const SITE_ID = "33333333-3333-4333-8333-333333333333";
const SLUG = "j7k2p9-touring-cars";

describe("<SitePage />", () => {
  it("renderiza business_name num <h1>", () => {
    render(<SitePage variables={SITE_FIXTURE} siteId={SITE_ID} slug={SLUG} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Touring Cars/i }),
    ).toBeInTheDocument();
  });

  it("aplica CSS vars --site-primary e --site-text-on-primary no wrapper", () => {
    const { container } = render(
      <SitePage variables={SITE_FIXTURE} siteId={SITE_ID} slug={SLUG} />,
    );
    const wrapper = container.querySelector<HTMLElement>(".site-page");
    expect(wrapper).not.toBeNull();
    // CSS vars são acessadas via getPropertyValue (jsdom respeita inline style).
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

  it("aceita as 3 props (variables, siteId, slug) e renderiza sem crashar", () => {
    expect(() =>
      render(<SitePage variables={SITE_FIXTURE} siteId={SITE_ID} slug={SLUG} />),
    ).not.toThrow();
  });

  it("sanitiza cores via sanitizeHex — input adversarial vira fallback", () => {
    const adversarial = {
      ...SITE_FIXTURE,
      // bypass type checker: simulamos um banco corrompido.
      primary_color: "red; background: url(x);" as unknown as `#${string}`,
    };
    const { container } = render(
      <SitePage variables={adversarial} siteId={SITE_ID} slug={SLUG} />,
    );
    const wrapper = container.querySelector<HTMLElement>(".site-page");
    expect(wrapper).not.toBeNull();
    // Deve cair no DEFAULT_HEX (#0C0C0C) — sem injetar declaração maliciosa.
    expect(
      wrapper!.style.getPropertyValue("--site-primary"),
    ).toBe("#0C0C0C");
  });
});
