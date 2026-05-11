import { describe, expect, it } from "vitest";

import {
  parseStockSortKey,
  sortCars,
  STOCK_SORT_OPTIONS,
} from "@/lib/stock/sort";
import type { SiteCar } from "@/types/lead-site";

const cars = [
  makeCar({
    slug: "older-expensive",
    brand: "Toyota",
    model: "Corolla",
    year: 2021,
    price: 130_000,
    km: 42_000,
    featured: false,
  }),
  makeCar({
    slug: "featured-mid",
    brand: "Honda",
    model: "Civic",
    year: 2020,
    price: 110_000,
    km: 58_000,
    featured: true,
  }),
  makeCar({
    slug: "newer-cheap",
    brand: "Volkswagen",
    model: "Nivus",
    year: 2024,
    price: 98_000,
    km: 18_000,
    featured: false,
  }),
  makeCar({
    slug: "no-price",
    brand: "Jeep",
    model: "Compass",
    year: 2023,
    price: null,
    km: 12_000,
    featured: false,
  }),
] satisfies SiteCar[];

describe("sortCars", () => {
  it("mantém o input imutável", () => {
    const original = cars.map((car) => car.slug);
    sortCars(cars, "price_asc");
    expect(cars.map((car) => car.slug)).toEqual(original);
  });

  it("most_recent ordena destaque primeiro e depois ano mais recente", () => {
    expect(sortCars(cars, "most_recent").map((car) => car.slug)).toEqual([
      "featured-mid",
      "newer-cheap",
      "no-price",
      "older-expensive",
    ]);
  });

  it("price_asc coloca carros sem preço no fim", () => {
    expect(sortCars(cars, "price_asc").map((car) => car.slug)).toEqual([
      "newer-cheap",
      "featured-mid",
      "older-expensive",
      "no-price",
    ]);
  });

  it("price_desc coloca carros sem preço no fim", () => {
    expect(sortCars(cars, "price_desc").map((car) => car.slug)).toEqual([
      "older-expensive",
      "featured-mid",
      "newer-cheap",
      "no-price",
    ]);
  });

  it("installment_asc usa a mesma regra financeira dos cards", () => {
    expect(sortCars(cars, "installment_asc").map((car) => car.slug)).toEqual([
      "newer-cheap",
      "featured-mid",
      "older-expensive",
      "no-price",
    ]);
  });

  it("km_asc ordena por menor quilometragem", () => {
    expect(sortCars(cars, "km_asc").map((car) => car.slug)).toEqual([
      "no-price",
      "newer-cheap",
      "older-expensive",
      "featured-mid",
    ]);
  });
});

describe("parseStockSortKey", () => {
  it("aceita somente as 5 opções públicas", () => {
    expect(STOCK_SORT_OPTIONS.map((option) => option.value)).toEqual([
      "most_recent",
      "price_asc",
      "price_desc",
      "installment_asc",
      "km_asc",
    ]);
    expect(parseStockSortKey("price_desc")).toBe("price_desc");
    expect(parseStockSortKey("featured")).toBe("most_recent");
    expect(parseStockSortKey(undefined)).toBe("most_recent");
  });
});

function makeCar(overrides: Partial<SiteCar>): SiteCar {
  return {
    slug: "toyota-corolla-2022",
    brand: "Toyota",
    model: "Corolla",
    version: "XEi",
    year: 2022,
    price: 119_900,
    km: 30_000,
    transmission: "Automático",
    fuel: "Flex",
    color: "Prata",
    category: "Sedan",
    thumbnail_url: "/assets/stock/corolla.png",
    gallery_urls: ["/assets/stock/corolla.png"],
    photos: ["/assets/stock/corolla.png"],
    description: "Sedan seminovo.",
    featured: false,
    datasheet: [["Motor", "2.0"]],
    ...overrides,
  };
}
