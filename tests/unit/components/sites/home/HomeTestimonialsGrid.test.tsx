/**
 * Tests do <HomeTestimonialsGrid /> (issue #223 / Sprint 4 / H3).
 *
 * 3 cards lendo `variables.testimonials[]` v2 (slice 0,3). Quando
 * ausente/vazio, fallback hardcoded neutros PT-BR (Maria S./SP, João
 * P./PR, Ana C./MG — PO decision).
 */
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { HomeTestimonialsGrid } from "@/components/sites/home/HomeTestimonialsGrid";
import type { Testimonial } from "@/types/lead-site";

expect.extend(toHaveNoViolations);

const realTestimonial: Testimonial = {
  author_name: "Carlos R.",
  author_avatar_url: null,
  rating: 5,
  text: "Comprei meu primeiro carro aqui em 2025, voltei pelo segundo.",
  source: "manual",
};

describe("<HomeTestimonialsGrid />", () => {
  it("renderiza section com aria-label", () => {
    render(
      <HomeTestimonialsGrid testimonials={null} primary_color="#0C0C0C" />,
    );
    expect(
      screen.getByRole("region", { name: /avalia[çc][õo]es de clientes/i }),
    ).toBeInTheDocument();
  });

  describe("fallback hardcoded (sem testimonials)", () => {
    it("usa 3 fallback testimonials PT-BR neutros", () => {
      render(
        <HomeTestimonialsGrid testimonials={null} primary_color="#0C0C0C" />,
      );
      expect(screen.getByText(/Maria S\./)).toBeInTheDocument();
      expect(screen.getByText(/João P\./)).toBeInTheDocument();
      expect(screen.getByText(/Ana C\./)).toBeInTheDocument();
    });

    it("renderiza cidades fallback Pareadas", () => {
      render(
        <HomeTestimonialsGrid testimonials={null} primary_color="#0C0C0C" />,
      );
      expect(screen.getByText(/São Paulo\/SP/)).toBeInTheDocument();
      expect(screen.getByText(/Curitiba\/PR/)).toBeInTheDocument();
      expect(screen.getByText(/Belo Horizonte\/MG/)).toBeInTheDocument();
    });

    it("fallback quando testimonials é array vazio", () => {
      render(
        <HomeTestimonialsGrid testimonials={[]} primary_color="#0C0C0C" />,
      );
      expect(screen.getByText(/Maria S\./)).toBeInTheDocument();
    });
  });

  describe("usa testimonials reais quando presentes", () => {
    it("renderiza nome + texto", () => {
      render(
        <HomeTestimonialsGrid
          testimonials={[realTestimonial]}
          primary_color="#0C0C0C"
        />,
      );
      expect(screen.getByText("Carlos R.")).toBeInTheDocument();
      expect(screen.getByText(/Comprei meu primeiro carro/)).toBeInTheDocument();
    });

    it("limita a 3 cards mesmo com mais de 3 inputs (slice)", () => {
      const many: Testimonial[] = Array.from({ length: 6 }).map((_, i) => ({
        author_name: `Author ${i}`,
        author_avatar_url: null,
        rating: 5,
        text: `Depoimento número ${i} com texto suficiente`,
        source: "manual" as const,
      }));
      render(
        <HomeTestimonialsGrid testimonials={many} primary_color="#0C0C0C" />,
      );
      const items = screen
        .getByRole("region", { name: /avalia[çc][õo]es de clientes/i })
        .querySelectorAll("ul li");
      expect(items).toHaveLength(3);
    });
  });

  it("renderiza monogram (1ª letra) por testimonial", () => {
    render(
      <HomeTestimonialsGrid testimonials={null} primary_color="#0C0C0C" />,
    );
    // 3 cards × 1 monogram cada = 3 spans com letras "M", "J", "A".
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("J")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("zero violations a11y (axe-core)", async () => {
    const { container } = render(
      <HomeTestimonialsGrid testimonials={null} primary_color="#0C0C0C" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
