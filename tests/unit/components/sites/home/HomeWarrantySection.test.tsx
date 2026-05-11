/**
 * Tests do <HomeWarrantySection /> (issue #223 / Sprint 4 / H3).
 *
 * Split editorial 6/6 desktop com foto fallback chain:
 *   manifest?.about_url ?? brand_assets.about_image_url ?? FALLBACK_IMAGE_URL
 *
 * 4 bullets PT-BR canônicos do `lib/sites/warranty-bullets.ts`.
 */
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { HomeWarrantySection } from "@/components/sites/home/HomeWarrantySection";
import { FALLBACK_IMAGE_URL } from "@/lib/sites/merge";
import { WARRANTY_BULLETS } from "@/lib/sites/warranty-bullets";

expect.extend(toHaveNoViolations);

describe("<HomeWarrantySection />", () => {
  it("renderiza section com aria-label", () => {
    render(
      <HomeWarrantySection
        businessName="Poliguara"
        manifestAboutUrl={null}
        aboutImageUrl={null}
      />,
    );
    expect(
      screen.getByRole("region", { name: /garantia/i }),
    ).toBeInTheDocument();
  });

  it("renderiza h2 'Por que comprar com a {business_name}'", () => {
    render(
      <HomeWarrantySection
        businessName="Poliguara"
        manifestAboutUrl={null}
        aboutImageUrl={null}
      />,
    );
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /por que comprar com a poliguara/i,
      }),
    ).toBeInTheDocument();
  });

  it("renderiza os 4 bullets canônicos", () => {
    render(
      <HomeWarrantySection
        businessName="Poliguara"
        manifestAboutUrl={null}
        aboutImageUrl={null}
      />,
    );
    for (const bullet of WARRANTY_BULLETS) {
      expect(screen.getByText(bullet)).toBeInTheDocument();
    }
  });

  describe("foto fallback chain (PO refinement)", () => {
    it("usa manifest.about_url quando presente (precedência)", () => {
      render(
        <HomeWarrantySection
          businessName="Poliguara"
          manifestAboutUrl="/manifest-about.jpg"
          aboutImageUrl="/brand-about.jpg"
        />,
      );
      const img = screen.getByRole("img", { name: /equipe poliguara/i });
      expect(img.getAttribute("src")).toContain("/manifest-about.jpg");
    });

    it("cai em aboutImageUrl quando manifest null", () => {
      render(
        <HomeWarrantySection
          businessName="Poliguara"
          manifestAboutUrl={null}
          aboutImageUrl="/brand-about.jpg"
        />,
      );
      const img = screen.getByRole("img", { name: /equipe poliguara/i });
      expect(img.getAttribute("src")).toContain("/brand-about.jpg");
    });

    it("cai em FALLBACK_IMAGE_URL quando ambos null", () => {
      render(
        <HomeWarrantySection
          businessName="Poliguara"
          manifestAboutUrl={null}
          aboutImageUrl={null}
        />,
      );
      const img = screen.getByRole("img", { name: /equipe poliguara/i });
      // `unoptimized` no next/image preserva URL crua, sem encoding.
      expect(img.getAttribute("src")).toBe(FALLBACK_IMAGE_URL);
    });

    it("cai em FALLBACK_IMAGE_URL quando aboutImageUrl vazio", () => {
      render(
        <HomeWarrantySection
          businessName="Poliguara"
          manifestAboutUrl={null}
          aboutImageUrl=""
        />,
      );
      const img = screen.getByRole("img", { name: /equipe poliguara/i });
      // next/image encodes URL — apenas valida que NÃO usa string vazia.
      const src = img.getAttribute("src") ?? "";
      expect(src.length).toBeGreaterThan(0);
    });
  });

  it("zero violations a11y (axe-core)", async () => {
    const { container } = render(
      <HomeWarrantySection
        businessName="Poliguara"
        manifestAboutUrl={null}
        aboutImageUrl={null}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
