/**
 * Testes do <HomeTradeinWidget /> (issue #222 / Sprint 4 / H2 +
 * issue #298 / WP-A — separação Trade-in/About).
 *
 * Split 6/6 desktop: foto editorial + h2 + body + 2 CTAs.
 *
 * **Foto chain (#298):** `manifestTradeinUrl ?? tradeinImageUrl ??
 * FALLBACK_PHOTO`. Independente de `about_url` / `about_image_url`,
 * que continuam alimentando `<HomeWarrantySection>` exclusivamente —
 * resolve a duplicação reportada pelo cliente Ducarmo.
 */
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { HomeTradeinWidget } from "@/components/sites/home/HomeTradeinWidget";

expect.extend(toHaveNoViolations);

const PHONE = "5511987654321";
const BUSINESS = "Touring Cars";
const SLUG = "j7k2p9-touring-cars";
const MANIFEST_TRADEIN = "https://cdn.example.com/tradein/manifest.jpg";
const TRADEIN_BRAND = "https://cdn.example.com/tradein/brand.jpg";
const FALLBACK_PHOTO_SRC = "/assets/about/porsche-model.png";

describe("<HomeTradeinWidget />", () => {
  it("renderiza header <h2> com copy 'Seu carro vale entrada'", () => {
    render(
      <HomeTradeinWidget
        manifestTradeinUrl={MANIFEST_TRADEIN}
        tradeinImageUrl={TRADEIN_BRAND}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: /seu carro vale entrada/i }),
    ).toBeInTheDocument();
  });

  it("foto: prefere manifestTradeinUrl quando presente", () => {
    render(
      <HomeTradeinWidget
        manifestTradeinUrl={MANIFEST_TRADEIN}
        tradeinImageUrl={TRADEIN_BRAND}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    const img = screen.getByTestId("tradein-photo") as HTMLImageElement;
    expect(img.src).toContain("tradein/manifest.jpg");
  });

  it("foto: fallback pra tradeinImageUrl quando manifestTradeinUrl é null", () => {
    render(
      <HomeTradeinWidget
        manifestTradeinUrl={null}
        tradeinImageUrl={TRADEIN_BRAND}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    const img = screen.getByTestId("tradein-photo") as HTMLImageElement;
    expect(img.src).toContain("tradein/brand.jpg");
  });

  it("foto: fallback final pra FALLBACK_PHOTO quando manifest e brand null", () => {
    render(
      <HomeTradeinWidget
        manifestTradeinUrl={null}
        tradeinImageUrl={null}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    const img = screen.getByTestId("tradein-photo") as HTMLImageElement;
    expect(img.src).toContain("porsche-model.png");
    expect(img.src).not.toContain("brand.jpg");
    expect(img.src).not.toContain("manifest.jpg");
  });

  it("foto: aceita tradeinImageUrl undefined (prop opcional) sem quebrar", () => {
    render(
      <HomeTradeinWidget
        manifestTradeinUrl={null}
        tradeinImageUrl={undefined}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    const img = screen.getByTestId("tradein-photo") as HTMLImageElement;
    expect(img.src).toContain(FALLBACK_PHOTO_SRC);
  });

  it("CTA primário aponta pra /anunciar do site", () => {
    render(
      <HomeTradeinWidget
        manifestTradeinUrl={MANIFEST_TRADEIN}
        tradeinImageUrl={TRADEIN_BRAND}
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
        manifestTradeinUrl={MANIFEST_TRADEIN}
        tradeinImageUrl={TRADEIN_BRAND}
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
        manifestTradeinUrl={MANIFEST_TRADEIN}
        tradeinImageUrl={TRADEIN_BRAND}
        whatsappPhone={PHONE}
        businessName={BUSINESS}
        siteSlug={SLUG}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
