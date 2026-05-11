/**
 * Testes do contrato compartilhado `stock-search-params` (issue #221 / Sprint 4 / H1).
 *
 * `serializeQuickSearch` / `parseQuickSearch` viram fonte única de verdade
 * para o querystring do quick search da Home e do filtro do /estoque (#224
 * E1). Short keys (`m`, `model`, `p`) per PO refinement do #221.
 */
import { describe, expect, it } from "vitest";

import {
  parseQuickSearch,
  serializeQuickSearch,
} from "@/lib/sites/stock-search-params";

describe("serializeQuickSearch", () => {
  it("emite todos os 3 campos quando preenchidos", () => {
    const qs = serializeQuickSearch({
      brand: "Toyota",
      model: "Corolla",
      priceMax: 120000,
    });
    expect(qs).toBe("m=Toyota&model=Corolla&p=120000");
  });

  it("omite campos vazios/null/undefined", () => {
    expect(
      serializeQuickSearch({ brand: "Honda", model: null, priceMax: null }),
    ).toBe("m=Honda");
    expect(
      serializeQuickSearch({
        brand: undefined,
        model: "HB20",
        priceMax: undefined,
      }),
    ).toBe("model=HB20");
    expect(serializeQuickSearch({})).toBe("");
  });

  it("faz trim em brand/model antes de emitir", () => {
    expect(
      serializeQuickSearch({ brand: "  Fiat  ", model: " Toro " }),
    ).toBe("m=Fiat&model=Toro");
  });

  it("trata string vazia/whitespace como ausente", () => {
    expect(
      serializeQuickSearch({ brand: "   ", model: "", priceMax: null }),
    ).toBe("");
  });

  it("ignora priceMax inválido (NaN/negativo/zero)", () => {
    expect(serializeQuickSearch({ priceMax: NaN })).toBe("");
    expect(serializeQuickSearch({ priceMax: 0 })).toBe("");
    expect(serializeQuickSearch({ priceMax: -100 })).toBe("");
  });

  it("encoda caracteres especiais via URLSearchParams", () => {
    // Toyota & Honda → 'Toyota & Honda' encoded
    const qs = serializeQuickSearch({ brand: "Toyota & Honda" });
    expect(qs).toBe("m=Toyota+%26+Honda");
  });

  it("arredonda priceMax para inteiro (floor)", () => {
    expect(serializeQuickSearch({ priceMax: 50000.99 })).toBe("p=50000");
  });
});

describe("parseQuickSearch", () => {
  it("parseia URLSearchParams cheio", () => {
    const params = new URLSearchParams("m=Toyota&model=Corolla&p=120000");
    expect(parseQuickSearch(params)).toEqual({
      brand: "Toyota",
      model: "Corolla",
      priceMax: 120000,
    });
  });

  it("aceita Record<string, string | string[] | undefined> (Next searchParams)", () => {
    expect(
      parseQuickSearch({
        m: "Honda",
        model: "Civic",
        p: "90000",
      }),
    ).toEqual({
      brand: "Honda",
      model: "Civic",
      priceMax: 90000,
    });
  });

  it("retorna null nos campos ausentes/vazios", () => {
    expect(parseQuickSearch(new URLSearchParams())).toEqual({
      brand: null,
      model: null,
      priceMax: null,
    });
    expect(parseQuickSearch({ m: "  ", model: "" })).toEqual({
      brand: null,
      model: null,
      priceMax: null,
    });
  });

  it("faz trim do brand/model", () => {
    expect(parseQuickSearch({ m: "  Fiat  ", model: " Toro " })).toEqual({
      brand: "Fiat",
      model: "Toro",
      priceMax: null,
    });
  });

  it("ignora priceMax inválido (não-número, negativo, zero)", () => {
    expect(parseQuickSearch({ p: "abc" }).priceMax).toBeNull();
    expect(parseQuickSearch({ p: "-100" }).priceMax).toBeNull();
    expect(parseQuickSearch({ p: "0" }).priceMax).toBeNull();
    expect(parseQuickSearch({ p: "" }).priceMax).toBeNull();
  });

  it("trata array (primeiro valor) — Next coleta múltiplos params iguais", () => {
    expect(parseQuickSearch({ m: ["Toyota", "Honda"], p: ["10000"] })).toEqual(
      { brand: "Toyota", model: null, priceMax: 10000 },
    );
  });

  it("arredonda priceMax para inteiro", () => {
    expect(parseQuickSearch({ p: "120000.99" }).priceMax).toBe(120000);
  });

  it("round-trip serialize/parse preserva campos válidos", () => {
    const input = {
      brand: "Toyota",
      model: "Corolla",
      priceMax: 119900,
    };
    const qs = serializeQuickSearch(input);
    const parsed = parseQuickSearch(new URLSearchParams(qs));
    expect(parsed).toEqual(input);
  });
});
