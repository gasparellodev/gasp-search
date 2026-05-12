/**
 * Unit tests — `findSimilarCars` (Phase 7 / Sprint 6 / #D3 — issue #228).
 *
 * Algoritmo cross-conversion das "Veículos similares" no detalhe do carro:
 *
 *   ordem (1) mesma `category` (fallback `brand` quando `current.category`
 *   ausente OU nenhum carro casa categoria),
 *   ordem (2) faixa de preço ±20% (relaxa se a faixa zerar),
 *   ordem (3) sort por proximidade de preço asc.
 *
 *   Fallback: se `similar.length < limit`, completar com top-priced cars
 *   do pool (badge "Você também pode gostar" na UI). Lib expõe duas
 *   listas distintas (`similar` vs `fallback`) — UI decide visual.
 *
 *   Edge cases: `current.price === null`, exclusão por `slug`,
 *   categorias mistas com retrocompat v1 (`category` opcional no schema).
 *
 * Coverage target ≥95% lines (AC do issue #228).
 */
import { describe, expect, it } from "vitest";

import { findSimilarCars } from "@/lib/sites/find-similar-cars";
import type { SiteCar } from "@/types/lead-site";

// ---------------------------------------------------------------------------
// Local factory — payloads válidos contra `SiteCar` (sem fixture global)
// ---------------------------------------------------------------------------

let carCounter = 0;
function makeCar(overrides: Partial<SiteCar> = {}): SiteCar {
  carCounter += 1;
  const idx = carCounter;
  const base: SiteCar = {
    slug: overrides.slug ?? `car-${idx}`,
    brand: "Toyota",
    model: `Modelo ${idx}`,
    year: 2022,
    km: 30000,
    price: 100000,
    transmission: "Automático",
    fuel: "Flex",
    color: "Prata",
    description:
      "Carro seminovo revisado em concessionária autorizada. Documentação em dia, garantia da loja por 3 meses cobrindo motor e câmbio. Aceita troca.",
    thumbnail_url: `/assets/stock/car-${idx}.png`,
    gallery_urls: [
      `/assets/stock/car-${idx}-1.png`,
      `/assets/stock/car-${idx}-2.png`,
      `/assets/stock/car-${idx}-3.png`,
    ],
    datasheet: [["Motor", "1.0 Turbo"]],
    featured: false,
  };
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------

describe("findSimilarCars — Detail D3 (#228)", () => {
  describe("Empty / trivial cases", () => {
    it("retorna listas vazias quando estoque é vazio", () => {
      const current = makeCar({ slug: "current", category: "Sedan" });
      const result = findSimilarCars([], current);
      expect(result.similar).toEqual([]);
      expect(result.fallback).toEqual([]);
    });

    it("retorna listas vazias quando o único carro do estoque é o atual", () => {
      const current = makeCar({ slug: "current", category: "Sedan" });
      const result = findSimilarCars([current], current);
      expect(result.similar).toEqual([]);
      expect(result.fallback).toEqual([]);
    });

    it("exclui o atual do pool quando há mais carros com mesmo slug", () => {
      const current = makeCar({ slug: "duplicate-slug", category: "SUV" });
      const cars = [
        current,
        // homônimo (defensivo — em produção slug é único globalmente)
        makeCar({ slug: "duplicate-slug", category: "SUV", price: 99000 }),
        makeCar({ slug: "other-1", category: "SUV", price: 95000 }),
        makeCar({ slug: "other-2", category: "SUV", price: 105000 }),
      ];
      const result = findSimilarCars(cars, current);
      const slugs = result.similar.map((c) => c.slug);
      expect(slugs).toContain("other-1");
      expect(slugs).toContain("other-2");
      // O "duplicate-slug" (todos os homônimos) NÃO entra
      expect(slugs).not.toContain("duplicate-slug");
    });
  });

  describe("Primary match: same category", () => {
    it("retorna 4 carros mesma category dentro da faixa, ordenados por proximidade", () => {
      const current = makeCar({
        slug: "current",
        category: "Sedan",
        price: 100000,
      });
      const cars = [
        current,
        makeCar({ slug: "s-115", category: "Sedan", price: 115000 }),
        makeCar({ slug: "s-105", category: "Sedan", price: 105000 }),
        makeCar({ slug: "s-95", category: "Sedan", price: 95000 }),
        makeCar({ slug: "s-90", category: "Sedan", price: 90000 }),
        // Outras categories — não devem entrar como "similar"
        makeCar({ slug: "suv-100", category: "SUV", price: 100000 }),
      ];
      const result = findSimilarCars(cars, current);
      // Ordem esperada por proximidade: 105 (Δ5) < 95 (Δ5 mas tie por inserção) < 115 (Δ15) < 90 (Δ10)
      // Ajuste real esperado: |Δ| asc → 105 (5), 95 (5), 90 (10), 115 (15)
      expect(result.similar.map((c) => c.slug)).toEqual([
        "s-105",
        "s-95",
        "s-90",
        "s-115",
      ]);
      expect(result.fallback).toEqual([]);
    });

    it("completa com top-priced (fallback) quando similares < limit", () => {
      const current = makeCar({
        slug: "current",
        category: "Sedan",
        price: 100000,
      });
      const cars = [
        current,
        // 1 sedan dentro da faixa
        makeCar({ slug: "s-110", category: "Sedan", price: 110000 }),
        // 3 SUVs (não casa category) — top-priced wins
        makeCar({ slug: "suv-500", category: "SUV", price: 500000 }),
        makeCar({ slug: "suv-200", category: "SUV", price: 200000 }),
        makeCar({ slug: "suv-300", category: "SUV", price: 300000 }),
      ];
      const result = findSimilarCars(cars, current);
      expect(result.similar.map((c) => c.slug)).toEqual(["s-110"]);
      // fallback completa até 4 (similar=1 + fallback=3): top-priced asc DESC
      expect(result.fallback.map((c) => c.slug)).toEqual([
        "suv-500",
        "suv-300",
        "suv-200",
      ]);
    });
  });

  describe("Brand fallback (V1 retrocompat — category opcional)", () => {
    it("usa brand match quando current.category é undefined", () => {
      const current = makeCar({
        slug: "current",
        brand: "Toyota",
        category: undefined,
        price: 100000,
      });
      const cars = [
        current,
        makeCar({ slug: "t-1", brand: "Toyota", price: 105000 }),
        makeCar({ slug: "t-2", brand: "Toyota", price: 95000 }),
        makeCar({ slug: "h-1", brand: "Honda", price: 100000 }),
        makeCar({ slug: "h-2", brand: "Honda", price: 102000 }),
      ];
      const result = findSimilarCars(cars, current);
      // Só Toyotas no similar (brand match)
      expect(result.similar.map((c) => c.slug).sort()).toEqual(["t-1", "t-2"]);
      // Hondas viram fallback (top-priced)
      expect(result.fallback.map((c) => c.slug)).toEqual(["h-2", "h-1"]);
    });

    it("brand match é case-insensitive", () => {
      const current = makeCar({
        slug: "current",
        brand: "TOYOTA",
        category: undefined,
        price: 100000,
      });
      const cars = [
        current,
        makeCar({ slug: "t-1", brand: "toyota", price: 100000 }),
        makeCar({ slug: "t-2", brand: "Toyota", price: 100000 }),
      ];
      const result = findSimilarCars(cars, current);
      expect(result.similar.map((c) => c.slug).sort()).toEqual(["t-1", "t-2"]);
    });

    it("usa brand match quando nenhum carro casa current.category", () => {
      const current = makeCar({
        slug: "current",
        brand: "Honda",
        category: "Conversível",
        price: 100000,
      });
      const cars = [
        current,
        makeCar({ slug: "h-1", brand: "Honda", category: "Sedan", price: 105000 }),
        makeCar({ slug: "h-2", brand: "Honda", category: "Hatch", price: 95000 }),
      ];
      const result = findSimilarCars(cars, current);
      // Nenhum Conversível → fallback brand match
      expect(result.similar.map((c) => c.slug).sort()).toEqual(["h-1", "h-2"]);
    });
  });

  describe("Price band ±20%", () => {
    it("filtra carros fora da faixa ±20% quando faixa NÃO zera o pool", () => {
      const current = makeCar({
        slug: "current",
        category: "Sedan",
        price: 100000,
      });
      const cars = [
        current,
        makeCar({ slug: "in-1", category: "Sedan", price: 90000 }),
        makeCar({ slug: "in-2", category: "Sedan", price: 115000 }),
        makeCar({ slug: "out-low", category: "Sedan", price: 50000 }),
        makeCar({ slug: "out-high", category: "Sedan", price: 200000 }),
      ];
      const result = findSimilarCars(cars, current);
      // Apenas in-1 e in-2 entram em similar (dentro da faixa 80k–120k)
      expect(result.similar.map((c) => c.slug).sort()).toEqual(["in-1", "in-2"]);
      // out-low e out-high viram fallback (top-priced)
      expect(result.fallback.map((c) => c.slug)).toEqual(["out-high", "out-low"]);
    });

    it("relaxa a faixa quando ela zera o pool primary (preserva primary inteiro)", () => {
      const current = makeCar({
        slug: "current",
        category: "Sedan",
        price: 1000,
      });
      // Todos fora da faixa ±20% (800-1200), mas mesma category
      const cars = [
        current,
        makeCar({ slug: "s-50k", category: "Sedan", price: 50000 }),
        makeCar({ slug: "s-100k", category: "Sedan", price: 100000 }),
        makeCar({ slug: "s-200k", category: "Sedan", price: 200000 }),
      ];
      const result = findSimilarCars(cars, current);
      // Faixa zerou primary → relaxa, mantém os 3 sedans ordenados por proximidade
      expect(result.similar.map((c) => c.slug)).toEqual([
        "s-50k",
        "s-100k",
        "s-200k",
      ]);
      expect(result.fallback).toEqual([]);
    });

    it("não filtra por faixa quando current.price é null", () => {
      const current = makeCar({
        slug: "current",
        category: "Sedan",
        price: null,
      });
      const cars = [
        current,
        makeCar({ slug: "s-cheap", category: "Sedan", price: 10000 }),
        makeCar({ slug: "s-mid", category: "Sedan", price: 100000 }),
        makeCar({ slug: "s-rich", category: "Sedan", price: 1000000 }),
        makeCar({ slug: "s-null", category: "Sedan", price: null }),
      ];
      const result = findSimilarCars(cars, current);
      // Todos sedans entram em similar (sem filtro de faixa, sem sort por proximidade)
      expect(result.similar.map((c) => c.slug).sort()).toEqual([
        "s-cheap",
        "s-mid",
        "s-null",
        "s-rich",
      ]);
      expect(result.fallback).toEqual([]);
    });

    it("ignora carros com price null na ordenação por proximidade (vão para o fim)", () => {
      const current = makeCar({
        slug: "current",
        category: "Sedan",
        price: 100000,
      });
      const cars = [
        current,
        makeCar({ slug: "s-null", category: "Sedan", price: null }),
        makeCar({ slug: "s-105", category: "Sedan", price: 105000 }),
        makeCar({ slug: "s-95", category: "Sedan", price: 95000 }),
      ];
      const result = findSimilarCars(cars, current);
      // Os com preço (dentro da faixa) primeiro, ordenados por proximidade;
      // null vai pro fim (não filtrado, mas pesa Infinity)
      expect(result.similar.map((c) => c.slug)).toEqual([
        "s-105",
        "s-95",
        "s-null",
      ]);
    });
  });

  describe("Limit + fallback top-priced", () => {
    it("respeita limit personalizado (e.g. limit=2)", () => {
      const current = makeCar({
        slug: "current",
        category: "Sedan",
        price: 100000,
      });
      const cars = [
        current,
        makeCar({ slug: "s-1", category: "Sedan", price: 95000 }),
        makeCar({ slug: "s-2", category: "Sedan", price: 105000 }),
        makeCar({ slug: "s-3", category: "Sedan", price: 110000 }),
        makeCar({ slug: "s-4", category: "Sedan", price: 90000 }),
      ];
      const result = findSimilarCars(cars, current, 2);
      expect(result.similar.length + result.fallback.length).toBeLessThanOrEqual(
        2,
      );
    });

    it("fallback exclui carros já em similar", () => {
      const current = makeCar({
        slug: "current",
        category: "Sedan",
        price: 100000,
      });
      const cars = [
        current,
        makeCar({ slug: "s-1", category: "Sedan", price: 95000 }),
        makeCar({ slug: "suv-1", category: "SUV", price: 500000 }),
      ];
      const result = findSimilarCars(cars, current);
      const allSlugs = [
        ...result.similar.map((c) => c.slug),
        ...result.fallback.map((c) => c.slug),
      ];
      // Sem duplicatas entre similar e fallback
      expect(new Set(allSlugs).size).toBe(allSlugs.length);
    });

    it("fallback NÃO completa quando o pool total já se esgotou (estoque pequeno)", () => {
      const current = makeCar({
        slug: "current",
        category: "Sedan",
        price: 100000,
      });
      // Estoque total = 2 (current + 1 sedan)
      const cars = [
        current,
        makeCar({ slug: "s-only", category: "Sedan", price: 105000 }),
      ];
      const result = findSimilarCars(cars, current);
      // Não há nada pra fallback → 1 similar + 0 fallback
      expect(result.similar.map((c) => c.slug)).toEqual(["s-only"]);
      expect(result.fallback).toEqual([]);
    });

    it("fallback ignora carros sem price (não conta como top-priced)", () => {
      // Brand + category distintas pra forçar primary vazio.
      const current = makeCar({
        slug: "current",
        brand: "Audi",
        category: "Sedan",
        price: 100000,
      });
      const cars = [
        current,
        // 0 similares (brand BMW ≠ Audi, category SUV ≠ Sedan) → tudo cai em fallback
        makeCar({
          slug: "suv-null",
          brand: "BMW",
          category: "SUV",
          price: null,
        }),
        makeCar({
          slug: "suv-300",
          brand: "BMW",
          category: "SUV",
          price: 300000,
        }),
        makeCar({
          slug: "suv-200",
          brand: "BMW",
          category: "SUV",
          price: 200000,
        }),
      ];
      const result = findSimilarCars(cars, current);
      expect(result.similar).toEqual([]);
      // Apenas carros com price participam de fallback top-priced
      expect(result.fallback.map((c) => c.slug)).toEqual([
        "suv-300",
        "suv-200",
      ]);
    });
  });
});
