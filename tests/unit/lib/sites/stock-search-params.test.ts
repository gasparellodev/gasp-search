/**
 * Testes do contrato compartilhado `stock-search-params` (issue #221 / Sprint 4 / H1).
 *
 * `serializeQuickSearch` / `parseQuickSearch` viram fonte única de verdade
 * para o querystring do quick search da Home e do filtro do /estoque (#224
 * E1). Short keys (`m`, `model`, `p`) per PO refinement do #221.
 */
import { describe, expect, it } from "vitest";

import {
  applyStockFilters,
  parseQuickSearch,
  parseStockFilters,
  serializeQuickSearch,
  serializeStockFilters,
} from "@/lib/sites/stock-search-params";

import { SITE_FIXTURE } from "../../components/sites/site-fixtures";

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

describe("parseStockFilters / serializeStockFilters", () => {
  it("parseia os 10 grupos de filtros com short keys canônicas", () => {
    const parsed = parseStockFilters(
      new URLSearchParams(
        "q=corolla&m=Toyota,Honda&model=Corolla&c=suv&pmin=50000&pmax=120000&imin=900&imax=2500&ymin=2019&ymax=2023&kmmin=10000&kmmax=70000&tr=Autom%C3%A1tico,CVT&fl=Flex&cor=Prata,Branco&page=2&sort=price",
      ),
    );

    expect(parsed).toMatchObject({
      search: "corolla",
      marca: ["Toyota", "Honda"],
      modelo: ["Corolla"],
      categoria: ["suv"],
      precoMin: 50000,
      precoMax: 120000,
      parcelaMin: 900,
      parcelaMax: 2500,
      anoMin: 2019,
      anoMax: 2023,
      kmMin: 10000,
      kmMax: 70000,
      cambio: ["Automático", "CVT"],
      combustivel: ["Flex"],
      cor: ["prata", "branco"],
      passthrough: { page: "2", sort: "price" },
    });
  });

  it("serializa em ordem estável e preserva passthrough desconhecido", () => {
    const qs = serializeStockFilters({
      search: "corolla",
      marca: ["Toyota"],
      modelo: ["Corolla"],
      categoria: ["sedan"],
      precoMin: 50000,
      precoMax: 120000,
      parcelaMin: null,
      parcelaMax: null,
      anoMin: 2020,
      anoMax: 2023,
      kmMin: null,
      kmMax: 60000,
      cambio: ["CVT"],
      combustivel: ["Flex"],
      cor: ["prata"],
      passthrough: { sort: "price", page: "2" },
    });

    expect(qs).toBe(
      "sort=price&page=2&q=corolla&m=Toyota&model=Corolla&c=sedan&pmin=50000&pmax=120000&ymin=2020&ymax=2023&kmmax=60000&tr=CVT&fl=Flex&cor=prata",
    );
  });

  it("round-trip mantém filtros válidos e compatibilidade com serializeQuickSearch", () => {
    const quick = serializeQuickSearch({
      brand: "Toyota",
      model: "Corolla",
      priceMax: 120000,
    });
    const parsed = parseStockFilters(new URLSearchParams(quick));

    expect(parsed.marca).toEqual(["Toyota"]);
    expect(parsed.modelo).toEqual(["Corolla"]);
    expect(parsed.precoMax).toBe(120000);
    expect(serializeStockFilters(parsed)).toBe(
      "m=Toyota&model=Corolla&pmax=120000",
    );
  });

  it("ignora valores inválidos sem derrubar o parser", () => {
    expect(
      parseStockFilters({
        c: "suv,invalida",
        pmin: "-1",
        pmax: "abc",
        ymin: "99",
        tr: "Automático,Invalido",
      }),
    ).toMatchObject({
      categoria: ["suv"],
      precoMin: null,
      precoMax: null,
      anoMin: null,
      cambio: ["Automático"],
    });
  });
});

describe("applyStockFilters", () => {
  it("filtra em memória por busca textual brand/model", () => {
    const filtered = applyStockFilters(SITE_FIXTURE.cars, {
      ...parseStockFilters({ q: "t-cross" }),
    });
    expect(filtered.map((car) => car.slug)).toEqual(["vw-tcross-2020"]);
  });

  it("combina categoria heurística, preço, ano, km, câmbio, combustível e cor", () => {
    const filtered = applyStockFilters(
      SITE_FIXTURE.cars,
      parseStockFilters({
        c: "sedan",
        pmax: "120000",
        ymin: "2021",
        kmmax: "50000",
        tr: "CVT,Automático",
        fl: "Flex",
        cor: "prata,branco",
      }),
    );

    expect(filtered.map((car) => car.slug)).toEqual([
      "toyota-corolla-2022",
      "honda-civic-2021",
    ]);
  });

  it("exclui preço null quando há filtro de preço ou parcela", () => {
    const [car] = SITE_FIXTURE.cars;
    const withoutPrice = { ...car!, price: null };

    expect(
      applyStockFilters([withoutPrice], parseStockFilters({ pmax: "100000" })),
    ).toHaveLength(0);
    expect(
      applyStockFilters([withoutPrice], parseStockFilters({ imax: "2000" })),
    ).toHaveLength(0);
  });
});
