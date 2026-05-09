import { describe, expect, it } from "vitest";

import manifest from "@/lib/sites/stock-photos.manifest.json";
import {
  pickCarStock,
  STOCK_PHOTOS_TOTAL,
} from "@/lib/sites/stock-photos";
import {
  stockManifestSchema,
  type StockCarEntry,
} from "@/lib/sites/stock-photos.schema";

describe("stockManifestSchema", () => {
  it("AC1 — valida o manifest V1 sem throw no module load", () => {
    expect(() => stockManifestSchema.parse(manifest)).not.toThrow();
  });

  it("AC1 — manifest tem version 1.0.0 e exatamente 14 cars (sea-doo NÃO incluído)", () => {
    const parsed = stockManifestSchema.parse(manifest);
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.cars).toHaveLength(14);
    expect(STOCK_PHOTOS_TOTAL).toBe(14);
    const ids = parsed.cars.map((c) => c.id);
    expect(ids).not.toContain("sea-doo");
    expect(ids).not.toContain("sea-doo-stock");
  });

  it("AC1 — todos os ids são únicos (sem duplicata silenciosa)", () => {
    const parsed = stockManifestSchema.parse(manifest);
    const ids = parsed.cars.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("AC1 — toda url começa com /assets/stock/ e termina com .png", () => {
    const parsed = stockManifestSchema.parse(manifest);
    for (const car of parsed.cars) {
      expect(car.url.startsWith("/assets/stock/")).toBe(true);
      expect(car.url.endsWith(".png")).toBe(true);
    }
  });

  it("AC1 — rejeita category fora do enum", () => {
    expect(() =>
      stockManifestSchema.parse({
        version: "1.0.0",
        cars: [
          {
            id: "x",
            category: "jet",
            condition: "0km",
            url: "/assets/stock/x.png",
            alt: "x",
          },
        ],
      }),
    ).toThrow();
  });

  it("AC1 — rejeita id com maiúscula ou caractere inválido", () => {
    expect(() =>
      stockManifestSchema.parse({
        version: "1.0.0",
        cars: [
          {
            id: "BMW-M2",
            category: "esportivo",
            condition: "0km",
            url: "/assets/stock/m2.png",
            alt: "BMW M2",
          },
        ],
      }),
    ).toThrow();
  });

  it("AC1 — rejeita url sem prefixo /assets/stock/", () => {
    expect(() =>
      stockManifestSchema.parse({
        version: "1.0.0",
        cars: [
          {
            id: "x",
            category: "sedan",
            condition: "0km",
            url: "assets/stock/x.png",
            alt: "x",
          },
        ],
      }),
    ).toThrow();
  });

  it("AC1 — rejeita url que não termina em .png", () => {
    expect(() =>
      stockManifestSchema.parse({
        version: "1.0.0",
        cars: [
          {
            id: "x",
            category: "sedan",
            condition: "0km",
            url: "/assets/stock/x.jpg",
            alt: "x",
          },
        ],
      }),
    ).toThrow();
  });

  it("AC1 — rejeita alt vazio", () => {
    expect(() =>
      stockManifestSchema.parse({
        version: "1.0.0",
        cars: [
          {
            id: "x",
            category: "sedan",
            condition: "0km",
            url: "/assets/stock/x.png",
            alt: "",
          },
        ],
      }),
    ).toThrow();
  });
});

describe("pickCarStock()", () => {
  it("AC2 — retorna `count` entries únicos (count=6)", () => {
    const picked = pickCarStock({ business_type: "concessionaria", count: 6 });
    expect(picked).toHaveLength(6);
    const ids = picked.map((c) => c.id);
    expect(new Set(ids).size).toBe(6);
  });

  it("AC2 — count=0 retorna array vazio (não erro)", () => {
    const picked = pickCarStock({ business_type: "concessionaria", count: 0 });
    expect(picked).toEqual([]);
  });

  it("AC2 — count=14 retorna todos os 14 sem repetição", () => {
    const picked = pickCarStock({
      business_type: "concessionaria",
      count: 14,
    });
    expect(picked).toHaveLength(14);
    const ids = picked.map((c) => c.id);
    expect(new Set(ids).size).toBe(14);
  });

  it("AC2 — mesma seed retorna mesma ordem (3 chamadas idênticas)", () => {
    const seed = "lead-abc";
    const a = pickCarStock({ business_type: "concessionaria", count: 8, seed });
    const b = pickCarStock({ business_type: "concessionaria", count: 8, seed });
    const c = pickCarStock({ business_type: "concessionaria", count: 8, seed });

    const aIds = a.map((x) => x.id);
    const bIds = b.map((x) => x.id);
    const cIds = c.map((x) => x.id);

    expect(aIds).toEqual(bIds);
    expect(bIds).toEqual(cIds);
  });

  it("AC2 — seeds diferentes retornam ordens diferentes", () => {
    const a = pickCarStock({
      business_type: "concessionaria",
      count: 14,
      seed: "lead-abc",
    });
    const b = pickCarStock({
      business_type: "concessionaria",
      count: 14,
      seed: "lead-xyz",
    });
    const aIds = a.map((x) => x.id);
    const bIds = b.map((x) => x.id);

    // Mesmo set de carros, mas pelo menos 1 posição diferente.
    expect(new Set(aIds)).toEqual(new Set(bIds));
    const sameAtAllPositions = aIds.every((id, i) => id === bIds[i]);
    expect(sameAtAllPositions).toBe(false);
  });

  it("AC2 — count > 14 lança erro com count solicitado e total disponível", () => {
    expect(() =>
      pickCarStock({ business_type: "concessionaria", count: 15 }),
    ).toThrow(/15 requested.*14 available/);
  });

  it("AC2 — sem seed, retorna `count` entries únicos (não-determinístico permitido)", () => {
    const picked = pickCarStock({ business_type: "concessionaria", count: 5 });
    expect(picked).toHaveLength(5);
    expect(new Set(picked.map((c) => c.id)).size).toBe(5);
  });

  it("AC2 — entries retornados batem o shape do schema", () => {
    const picked = pickCarStock({
      business_type: "concessionaria",
      count: 3,
      seed: "shape-check",
    });
    for (const entry of picked) {
      const e: StockCarEntry = entry;
      expect(typeof e.id).toBe("string");
      expect([
        "sedan",
        "suv",
        "picape",
        "hatch",
        "esportivo",
      ]).toContain(e.category);
      expect(["0km", "seminovo"]).toContain(e.condition);
      expect(e.url.startsWith("/assets/stock/")).toBe(true);
      expect(e.alt.length).toBeGreaterThan(0);
    }
  });

  it("AC2 — não muta o manifest (chamadas sucessivas com count=14 retornam superset estável)", () => {
    const first = pickCarStock({
      business_type: "concessionaria",
      count: 14,
      seed: "stable-1",
    });
    const second = pickCarStock({
      business_type: "concessionaria",
      count: 14,
      seed: "stable-2",
    });
    expect(first).toHaveLength(14);
    expect(second).toHaveLength(14);
    expect(new Set(first.map((c) => c.id))).toEqual(
      new Set(second.map((c) => c.id)),
    );
  });
});
