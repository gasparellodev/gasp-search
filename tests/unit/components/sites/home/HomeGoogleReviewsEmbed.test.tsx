/**
 * Tests do <HomeGoogleReviewsEmbed /> (issue #223 / Sprint 4 / H3).
 *
 * V1 hardcoded: big rating + count (props com fallback 4.8/87) + 3
 * placeholder reviews + caption + link Google.
 */
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { HomeGoogleReviewsEmbed } from "@/components/sites/home/HomeGoogleReviewsEmbed";

expect.extend(toHaveNoViolations);

describe("<HomeGoogleReviewsEmbed />", () => {
  it("renderiza section com aria-label", () => {
    render(
      <HomeGoogleReviewsEmbed
        rating={null}
        reviewsCount={null}
        primary_color="#0C0C0C"
      />,
    );
    expect(
      screen.getByRole("region", { name: /avalia[çc][õo]es no google/i }),
    ).toBeInTheDocument();
  });

  describe("rating/reviewsCount com fallback pareado", () => {
    it("ambos null → fallback 4.8 / 87", () => {
      render(
        <HomeGoogleReviewsEmbed
          rating={null}
          reviewsCount={null}
          primary_color="#0C0C0C"
        />,
      );
      expect(screen.getByText(/4\.8/)).toBeInTheDocument();
      expect(screen.getByText(/87/)).toBeInTheDocument();
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

    it("rating presente mas reviewsCount null → cai no fallback pareado", () => {
      render(
        <HomeGoogleReviewsEmbed
          rating={4.5}
          reviewsCount={null}
          primary_color="#0C0C0C"
        />,
      );
      expect(screen.getByText(/4\.8/)).toBeInTheDocument();
      expect(screen.getByText(/87/)).toBeInTheDocument();
    });

    it("rating 5 (inteiro) renderiza com 1 casa (toFixed 1)", () => {
      render(
        <HomeGoogleReviewsEmbed
          rating={5}
          reviewsCount={50}
          primary_color="#0C0C0C"
        />,
      );
      expect(screen.getByText("5.0")).toBeInTheDocument();
    });
  });

  it("renderiza 3 placeholder reviews", () => {
    render(
      <HomeGoogleReviewsEmbed
        rating={null}
        reviewsCount={null}
        primary_color="#0C0C0C"
      />,
    );
    const reviews = screen.getAllByText(/Cliente verificado/);
    expect(reviews).toHaveLength(3);
  });

  it("caption 'Avaliações do Google Business Profile'", () => {
    render(
      <HomeGoogleReviewsEmbed
        rating={null}
        reviewsCount={null}
        primary_color="#0C0C0C"
      />,
    );
    expect(
      screen.getByText(/avalia[çc][õo]es do google business profile/i),
    ).toBeInTheDocument();
  });

  it("link 'Ver todas no Google' externo com noopener", () => {
    render(
      <HomeGoogleReviewsEmbed
        rating={null}
        reviewsCount={null}
        primary_color="#0C0C0C"
      />,
    );
    const link = screen.getByRole("link", { name: /ver todas no google/i });
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
