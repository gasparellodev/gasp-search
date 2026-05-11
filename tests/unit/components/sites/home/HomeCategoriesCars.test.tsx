/**
 * Testes do <HomeCategoriesCars /> (issue #221 / Sprint 4 / H1).
 *
 * 6 cards 4:3 (SUV, Sedan, Hatch, Pickup, Esportivo, Conversível).
 * Fotos vindas de `manifest.categories_urls[CATEGORY_INDEX[slug]]` (PO refinement
 * — array indexado por posição). Link no card inteiro
 * → `/sites/<slug>/estoque?bodyType=<bodyType>` per BODY_TYPE_QUERY canônico.
 */
import { render, screen, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { HomeCategoriesCars } from "@/components/sites/home/HomeCategoriesCars";

expect.extend(toHaveNoViolations);

const SLUG = "j7k2p9-touring-cars";

const FULL_MANIFEST_CATEGORIES = [
  "https://cdn.example.com/cat/suv.jpg",
  "https://cdn.example.com/cat/sedan.jpg",
  "https://cdn.example.com/cat/hatch.jpg",
  "https://cdn.example.com/cat/pickup.jpg",
  "https://cdn.example.com/cat/esportivo.jpg",
  "https://cdn.example.com/cat/conversivel.jpg",
];

describe("<HomeCategoriesCars />", () => {
  it("renderiza 6 cards (SUV, Sedan, Hatch, Pickup, Esportivo, Conversível)", () => {
    render(
      <HomeCategoriesCars
        slug={SLUG}
        manifestCategoriesUrls={FULL_MANIFEST_CATEGORIES}
      />,
    );
    expect(screen.getByText("SUV")).toBeInTheDocument();
    expect(screen.getByText("Sedan")).toBeInTheDocument();
    expect(screen.getByText("Hatch")).toBeInTheDocument();
    expect(screen.getByText("Pickup")).toBeInTheDocument();
    expect(screen.getByText("Esportivo")).toBeInTheDocument();
    expect(screen.getByText("Conversível")).toBeInTheDocument();
  });

  it("link de cada card aponta para `/estoque?bodyType=<slug>` per BODY_TYPE_QUERY canônico", () => {
    render(
      <HomeCategoriesCars
        slug={SLUG}
        manifestCategoriesUrls={FULL_MANIFEST_CATEGORIES}
      />,
    );
    const list = screen.getByRole("list");
    const links = within(list).getAllByRole("link");
    expect(links).toHaveLength(6);
    expect(links[0]?.getAttribute("href")).toBe(
      `/sites/${SLUG}/estoque?bodyType=suv`,
    );
    expect(links[1]?.getAttribute("href")).toBe(
      `/sites/${SLUG}/estoque?bodyType=sedan`,
    );
    expect(links[2]?.getAttribute("href")).toBe(
      `/sites/${SLUG}/estoque?bodyType=hatch`,
    );
    expect(links[3]?.getAttribute("href")).toBe(
      `/sites/${SLUG}/estoque?bodyType=pickup`,
    );
    // Esportivo → "sport" per PO refinement (slug en-US alinhado com #224).
    expect(links[4]?.getAttribute("href")).toBe(
      `/sites/${SLUG}/estoque?bodyType=sport`,
    );
    // Conversível → "convertible"
    expect(links[5]?.getAttribute("href")).toBe(
      `/sites/${SLUG}/estoque?bodyType=convertible`,
    );
  });

  it("cada link tem aria-label descritivo (a11y)", () => {
    render(
      <HomeCategoriesCars
        slug={SLUG}
        manifestCategoriesUrls={FULL_MANIFEST_CATEGORIES}
      />,
    );
    expect(
      screen.getByRole("link", { name: /ver suvs no estoque/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /ver sedans no estoque/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /ver conversíveis no estoque/i }),
    ).toBeInTheDocument();
  });

  it("usa foto do manifest na posição correta (CATEGORY_INDEX)", () => {
    render(
      <HomeCategoriesCars
        slug={SLUG}
        manifestCategoriesUrls={FULL_MANIFEST_CATEGORIES}
      />,
    );
    const suvImg = screen.getByAltText(/Categoria SUV/i);
    expect(suvImg.getAttribute("src")).toBe(FULL_MANIFEST_CATEGORIES[0]);

    const conversivelImg = screen.getByAltText(/Categoria Conversível/i);
    expect(conversivelImg.getAttribute("src")).toBe(
      FULL_MANIFEST_CATEGORIES[5],
    );
  });

  it("manifest com menos de 6 fotos: posições ausentes caem em placeholder gracioso", () => {
    const partial = FULL_MANIFEST_CATEGORIES.slice(0, 2); // só SUV + Sedan
    render(
      <HomeCategoriesCars slug={SLUG} manifestCategoriesUrls={partial} />,
    );
    // 6 cards ainda renderizados (degradação gracefulm), mesmo sem fotos
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    // SUV usa manifest[0]
    expect(screen.getByAltText(/Categoria SUV/i).getAttribute("src")).toBe(
      FULL_MANIFEST_CATEGORIES[0],
    );
    // Esportivo (idx 4) → placeholder
    const espImg = screen.getByAltText(/Categoria Esportivo/i);
    expect(espImg.getAttribute("src")).toMatch(/data:image\/svg\+xml/);
  });

  it("manifest null/undefined: todos caem em placeholder gracioso", () => {
    render(<HomeCategoriesCars slug={SLUG} manifestCategoriesUrls={null} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    const suvImg = screen.getByAltText(/Categoria SUV/i);
    expect(suvImg.getAttribute("src")).toMatch(/data:image\/svg\+xml/);
  });

  it("mobile usa scroll-snap-x mandatory", () => {
    render(
      <HomeCategoriesCars
        slug={SLUG}
        manifestCategoriesUrls={FULL_MANIFEST_CATEGORIES}
      />,
    );
    const list = screen.getByRole("list");
    expect(list.className).toMatch(/snap-x/);
    expect(list.className).toMatch(/snap-mandatory/);
  });

  it("zero violations a11y (axe-core)", async () => {
    const { container } = render(
      <HomeCategoriesCars
        slug={SLUG}
        manifestCategoriesUrls={FULL_MANIFEST_CATEGORIES}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
