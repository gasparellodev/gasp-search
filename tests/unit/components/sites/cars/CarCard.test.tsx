/**
 * Tests para `<CarCard>` (Sprint 0 / #F4 — issue #201).
 *
 * Cobertura:
 *   - Render do shape v2 completo (`SITE_FIXTURE.cars[0]`).
 *   - `thumbnail_url` canon (v1+v2) — não `photos[0]`.
 *   - Eyebrow uppercase, h3, datasheet inline, price + installment.
 *   - WhatsApp link válido (`buildWhatsAppLink` via `stock-card` component).
 *   - `price === null` → "Sob consulta", sem installment.
 *   - Internal link `<Link>` para `/sites/<siteSlug>/estoque/<car.slug>`.
 *   - data-testid `car-card-<slug>` (compat com seletor E2E #164).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CarCard } from "@/components/sites/cars/CarCard";

import { SITE_FIXTURE } from "../site-fixtures";

const siteSlug = "abcd1234-touring-cars";
const businessName = SITE_FIXTURE.business_name;
const whatsappPhone = SITE_FIXTURE.whatsapp;
const car = SITE_FIXTURE.cars[0]; // Toyota Corolla 2022 — featured: true, price: 119900

describe("<CarCard />", () => {
  it("renderiza <article> com data-testid `car-card-<slug>`", () => {
    render(
      <CarCard
        car={car!}
        siteSlug={siteSlug}
        whatsappPhone={whatsappPhone}
        businessName={businessName}
      />,
    );
    const article = screen.getByTestId(`car-card-${car!.slug}`);
    expect(article.tagName.toLowerCase()).toBe("article");
  });

  it("renderiza foto usando thumbnail_url (canon v1+v2)", () => {
    render(
      <CarCard
        car={car!}
        siteSlug={siteSlug}
        whatsappPhone={whatsappPhone}
        businessName={businessName}
      />,
    );
    const img = screen.getByAltText(
      `${car!.brand} ${car!.model} ${car!.year}`,
    );
    expect(img.tagName.toLowerCase()).toBe("img");
    expect(img.getAttribute("src")).toBe(car!.thumbnail_url);
  });

  it("eyebrow é a marca em uppercase via CSS (class `uppercase`)", () => {
    render(
      <CarCard
        car={car!}
        siteSlug={siteSlug}
        whatsappPhone={whatsappPhone}
        businessName={businessName}
      />,
    );
    const eyebrow = screen.getByTestId(`car-card-${car!.slug}-eyebrow`);
    expect(eyebrow).toHaveTextContent(car!.brand);
    expect(eyebrow.className).toContain("uppercase");
  });

  it("h3 contém model + year", () => {
    render(
      <CarCard
        car={car!}
        siteSlug={siteSlug}
        whatsappPhone={whatsappPhone}
        businessName={businessName}
      />,
    );
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent(`${car!.model} ${car!.year}`);
  });

  it("data inline mostra km · fuel · transmission separados por middot", () => {
    render(
      <CarCard
        car={car!}
        siteSlug={siteSlug}
        whatsappPhone={whatsappPhone}
        businessName={businessName}
      />,
    );
    const data = screen.getByTestId(`car-card-${car!.slug}-data`);
    expect(data.textContent).toContain("·");
    expect(data.textContent).toContain(car!.fuel);
    expect(data.textContent).toContain(car!.transmission);
  });

  it("price-display formata BRL — price=119900 → 'R$ 119.900'", () => {
    render(
      <CarCard
        car={car!}
        siteSlug={siteSlug}
        whatsappPhone={whatsappPhone}
        businessName={businessName}
      />,
    );
    const price = screen.getByTestId(`car-card-${car!.slug}-price`);
    expect(price.textContent).toMatch(/R\$\s?119\.900/);
  });

  it("price-installment é renderizado com defaults (20% / 48m)", () => {
    render(
      <CarCard
        car={car!}
        siteSlug={siteSlug}
        whatsappPhone={whatsappPhone}
        businessName={businessName}
      />,
    );
    const installment = screen.getByTestId(
      `car-card-${car!.slug}-installment`,
    );
    expect(installment.textContent).toMatch(/Ou 48x de R\$\s?\d/);
  });

  it("WhatsApp link gerado via buildWhatsAppLink (stock-card component)", () => {
    render(
      <CarCard
        car={car!}
        siteSlug={siteSlug}
        whatsappPhone={whatsappPhone}
        businessName={businessName}
      />,
    );
    const whatsappLink = screen.getByTestId(
      `car-card-${car!.slug}-whatsapp`,
    );
    const href = whatsappLink.getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\//);
    expect(href).toContain(`utm_content=stock-card`);
    expect(href).toContain(`utm_campaign=vehicle`);
    expect(whatsappLink).toHaveAttribute("target", "_blank");
    expect(whatsappLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("link interno aponta para /sites/<siteSlug>/estoque/<car.slug>", () => {
    render(
      <CarCard
        car={car!}
        siteSlug={siteSlug}
        whatsappPhone={whatsappPhone}
        businessName={businessName}
      />,
    );
    const cardLink = screen.getByTestId(`car-card-${car!.slug}-link`);
    expect(cardLink).toHaveAttribute(
      "href",
      `/sites/${siteSlug}/estoque/${car!.slug}`,
    );
  });

  it("WhatsApp link NÃO está aninhado dentro do <Link> interno (sem nested anchor)", () => {
    const { container } = render(
      <CarCard
        car={car!}
        siteSlug={siteSlug}
        whatsappPhone={whatsappPhone}
        businessName={businessName}
      />,
    );
    // Verifica que nenhum <a> tem outro <a> dentro
    const anchors = container.querySelectorAll("a");
    for (const anchor of Array.from(anchors)) {
      expect(anchor.querySelectorAll("a")).toHaveLength(0);
    }
  });

  it("aria-labelledby aponta para h3 com id", () => {
    render(
      <CarCard
        car={car!}
        siteSlug={siteSlug}
        whatsappPhone={whatsappPhone}
        businessName={businessName}
      />,
    );
    const article = screen.getByTestId(`car-card-${car!.slug}`);
    const labelledBy = article.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const heading = document.getElementById(labelledBy!);
    expect(heading?.tagName.toLowerCase()).toBe("h3");
  });

  describe("price === null", () => {
    const carWithoutPrice = { ...car!, price: null };

    it("mostra 'Sob consulta' no lugar de BRL", () => {
      render(
        <CarCard
          car={carWithoutPrice}
          siteSlug={siteSlug}
          whatsappPhone={whatsappPhone}
          businessName={businessName}
        />,
      );
      const price = screen.getByTestId(
        `car-card-${carWithoutPrice.slug}-price`,
      );
      expect(price.textContent).toContain("Sob consulta");
    });

    it("NÃO renderiza price-installment", () => {
      render(
        <CarCard
          car={carWithoutPrice}
          siteSlug={siteSlug}
          whatsappPhone={whatsappPhone}
          businessName={businessName}
        />,
      );
      expect(
        screen.queryByTestId(`car-card-${carWithoutPrice.slug}-installment`),
      ).not.toBeInTheDocument();
    });
  });

  describe("hover lift via CSS vars", () => {
    it("aplica transition-transform com tokens auto-* na container", () => {
      render(
        <CarCard
          car={car!}
          siteSlug={siteSlug}
          whatsappPhone={whatsappPhone}
          businessName={businessName}
        />,
      );
      const article = screen.getByTestId(`car-card-${car!.slug}`);
      expect(article.className).toContain("transition-transform");
      expect(article.className).toContain("hover:-translate-y-0.5");
    });
  });
});
