/**
 * Tests do <HomeGoogleReviewsEmbed /> (issue #223 / Sprint 4 / H3 +
 * Wave A3 honesty pass — D-12).
 *
 * Comportamento atual:
 * - Sem rating válido (null/0) OU reviewsCount < 3 → componente retorna `null`
 *   (não renderiza a section, evita fake "4.8★ 87 reviews" + placeholders).
 * - Com rating + reviewsCount >= 3 → renderiza header big rating + CTA
 *   prominent para o GBP no Google Maps. Sem texts placeholder.
 */
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { HomeGoogleReviewsEmbed } from "@/components/sites/home/HomeGoogleReviewsEmbed";

expect.extend(toHaveNoViolations);

describe("<HomeGoogleReviewsEmbed /> — Wave A3 honesty pass", () => {
  describe("retorna null quando dados insuficientes", () => {
    it("ambos null → null (sem section, sem fake rating)", () => {
      const { container } = render(
        <HomeGoogleReviewsEmbed
          rating={null}
          reviewsCount={null}
          primary_color="#0C0C0C"
        />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("rating presente + reviewsCount null → null", () => {
      const { container } = render(
        <HomeGoogleReviewsEmbed
          rating={4.5}
          reviewsCount={null}
          primary_color="#0C0C0C"
        />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("rating presente + reviewsCount = 0 → null", () => {
      const { container } = render(
        <HomeGoogleReviewsEmbed
          rating={4.5}
          reviewsCount={0}
          primary_color="#0C0C0C"
        />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("rating presente + reviewsCount = 2 (abaixo do mínimo 3) → null", () => {
      const { container } = render(
        <HomeGoogleReviewsEmbed
          rating={5.0}
          reviewsCount={2}
          primary_color="#0C0C0C"
        />,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe("renderiza com dados válidos (rating > 0 + reviewsCount >= 3)", () => {
    it("renderiza section com aria-label", () => {
      render(
        <HomeGoogleReviewsEmbed
          rating={4.7}
          reviewsCount={123}
          primary_color="#0C0C0C"
        />,
      );
      expect(
        screen.getByRole("region", { name: /avalia[çc][õo]es no google/i }),
      ).toBeInTheDocument();
    });

    it("rating 4.7 + 123 reviews → '4.7' / '123'", () => {
      render(
        <HomeGoogleReviewsEmbed
          rating={4.7}
          reviewsCount={123}
          primary_color="#0C0C0C"
        />,
      );
      expect(screen.getByText("4.7")).toBeInTheDocument();
      expect(screen.getByText(/123 avalia/)).toBeInTheDocument();
    });

    it("rating 5 (inteiro) renderiza com 1 casa decimal (toFixed 1)", () => {
      render(
        <HomeGoogleReviewsEmbed
          rating={5}
          reviewsCount={50}
          primary_color="#0C0C0C"
        />,
      );
      expect(screen.getByText("5.0")).toBeInTheDocument();
    });

    it("não renderiza placeholders 'Cliente verificado'", () => {
      render(
        <HomeGoogleReviewsEmbed
          rating={4.5}
          reviewsCount={20}
          primary_color="#0C0C0C"
        />,
      );
      expect(screen.queryByText(/Cliente verificado/)).not.toBeInTheDocument();
    });

    it("caption 'Avaliações verificadas no Google Business Profile'", () => {
      render(
        <HomeGoogleReviewsEmbed
          rating={4.5}
          reviewsCount={20}
          primary_color="#0C0C0C"
        />,
      );
      expect(
        screen.getByText(
          /avalia[çc][õo]es verificadas no google business profile/i,
        ),
      ).toBeInTheDocument();
    });

    it("CTA 'Ler todas as avaliações no Google' externo com noopener", () => {
      render(
        <HomeGoogleReviewsEmbed
          rating={4.5}
          reviewsCount={20}
          primary_color="#0C0C0C"
        />,
      );
      const link = screen.getByRole("link", {
        name: /ler todas as avalia[çc][õo]es no google/i,
      });
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    });

    it("zero violations a11y (axe-core)", async () => {
      const { container } = render(
        <HomeGoogleReviewsEmbed
          rating={4.8}
          reviewsCount={87}
          primary_color="#0C0C0C"
        />,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
