import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeCategories } from "@/components/sites/home/HomeCategories";

import { SITE_FIXTURE } from "../site-fixtures";

const SLUG = "j7k2p9-touring-cars";

describe("<HomeCategories />", () => {
  it("renderiza um <h2> de seção", () => {
    render(
      <HomeCategories
        categories={SITE_FIXTURE.home_categories}
        slug={SLUG}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: /categori/i }),
    ).toBeInTheDocument();
  });

  it("renderiza 3 categorias (links com `/estoque?categoria=<slug>`)", () => {
    render(
      <HomeCategories
        categories={SITE_FIXTURE.home_categories}
        slug={SLUG}
      />,
    );

    const sedan = screen.getByRole("link", { name: /sedan/i });
    expect(sedan).toHaveAttribute(
      "href",
      `/sites/${SLUG}/estoque?categoria=sedan`,
    );

    const suv = screen.getByRole("link", { name: /suv/i });
    expect(suv).toHaveAttribute(
      "href",
      `/sites/${SLUG}/estoque?categoria=suv`,
    );

    const hatch = screen.getByRole("link", { name: /hatch/i });
    expect(hatch).toHaveAttribute(
      "href",
      `/sites/${SLUG}/estoque?categoria=hatch`,
    );
  });

  it("renderiza imagens com alt `Categoria <label>`", () => {
    render(
      <HomeCategories
        categories={SITE_FIXTURE.home_categories}
        slug={SLUG}
      />,
    );
    expect(screen.getByAltText("Categoria Sedan")).toBeInTheDocument();
    expect(screen.getByAltText("Categoria SUV")).toBeInTheDocument();
    expect(screen.getByAltText("Categoria Hatch")).toBeInTheDocument();
  });

  it("slugifica labels com acentos no querystring `?categoria=`", () => {
    render(
      <HomeCategories
        categories={[
          {
            label: "Caminhonete",
            image_url: "https://cdn.example.com/cat/1.jpg",
          },
          {
            label: "Sedã",
            image_url: "https://cdn.example.com/cat/2.jpg",
          },
          {
            label: "Hatch",
            image_url: "https://cdn.example.com/cat/3.jpg",
          },
        ]}
        slug={SLUG}
      />,
    );
    const sedan = screen.getByRole("link", { name: /sedã/i });
    expect(sedan).toHaveAttribute(
      "href",
      `/sites/${SLUG}/estoque?categoria=seda`,
    );
  });
});
