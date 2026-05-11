/**
 * Testes do <HomeTradeinWidget /> (issue #222 / Sprint 4 / H2).
 *
 * Split 6/6 desktop: foto editorial + h2 + body + 2 CTAs.
 * Foto: `manifest.about_url ?? variables.brand_assets.about_image_url ??
 * '/assets/about/dealership-warm.png'` (PO decision B1 — reuso do slot
 * about por enquanto; follow-up issue para spec dedicado se conversion
 * data justificar).
 */
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { HomeTradeinWidget } from "@/components/sites/home/HomeTradeinWidget";

expect.extend(toHaveNoViolations);

const PHONE = "5511987654321";
const BUSINESS = "Touring Cars";
const SLUG = "j7k2p9-touring-cars";
const MANIFEST_ABOUT = "https://cdn.example.com/about/manifest.jpg";
const FALLBACK_ABOUT = "/assets/about/porsche-model.png";

describe("<HomeTradeinWidget />", () => {
  it("renderiza header <h2> com copy 'Seu carro vale entrada'", () => {
    render(
      <HomeTradeinWidget
        manifestAboutUrl={MANIFEST_ABOUT}
        aboutImageUrl={FALLBACK_ABOUT}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: /seu carro vale entrada/i }),
    ).toBeInTheDocument();
  });

  it("foto: prefere manifestAboutUrl quando presente", () => {
    render(
      <HomeTradeinWidget
        manifestAboutUrl={MANIFEST_ABOUT}
        aboutImageUrl={FALLBACK_ABOUT}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    const img = screen.getByTestId("tradein-photo") as HTMLImageElement;
    expect(img.src).toContain("manifest.jpg");
  });

  it("foto: fallback pra aboutImageUrl quando manifestAboutUrl é null", () => {
    render(
      <HomeTradeinWidget
        manifestAboutUrl={null}
        aboutImageUrl={FALLBACK_ABOUT}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    const img = screen.getByTestId("tradein-photo") as HTMLImageElement;
    expect(img.src).toContain("porsche-model.png");
  });

  it("CTA primário aponta pra /anunciar do site", () => {
    render(
      <HomeTradeinWidget
        manifestAboutUrl={MANIFEST_ABOUT}
        aboutImageUrl={FALLBACK_ABOUT}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    const cta = screen.getByRole("link", { name: /avaliar meu carro/i });
    expect(cta.getAttribute("href")).toBe(`/sites/${SLUG}/anunciar`);
  });

  it("CTA WhatsApp usa template tradein (utm_campaign=tradein)", () => {
    render(
      <HomeTradeinWidget
        manifestAboutUrl={MANIFEST_ABOUT}
        aboutImageUrl={FALLBACK_ABOUT}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    const cta = screen.getByRole("link", { name: /whatsapp/i });
    const href = cta.getAttribute("href") ?? "";
    expect(href).toContain("wa.me/");
    expect(href).toContain("utm_campaign=tradein");
  });

  it("a11y — jest-axe ZERO violations", async () => {
    const { container } = render(
      <HomeTradeinWidget
        manifestAboutUrl={MANIFEST_ABOUT}
        aboutImageUrl={FALLBACK_ABOUT}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
