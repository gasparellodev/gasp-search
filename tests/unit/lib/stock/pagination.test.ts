import { describe, expect, it } from "vitest";

import { paginate, parseStockPage } from "@/lib/stock/pagination";

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, index) => `car-${index + 1}`);

  it("retorna slice da página solicitada com metadata", () => {
    expect(paginate(items, 2, 12)).toEqual({
      items: items.slice(12, 24),
      page: 2,
      perPage: 12,
      totalItems: 25,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  it("clampa página menor que 1 para 1", () => {
    expect(paginate(items, 0, 12).page).toBe(1);
  });

  it("clampa página acima do total para a última página", () => {
    const result = paginate(items, 99, 12);
    expect(result.page).toBe(3);
    expect(result.items).toEqual(["car-25"]);
  });

  it("usa uma página vazia estável quando não há items", () => {
    expect(paginate([], 3, 12)).toEqual({
      items: [],
      page: 1,
      perPage: 12,
      totalItems: 0,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  });
});

describe("parseStockPage", () => {
  it("aceita inteiros positivos e rejeita valores inválidos", () => {
    expect(parseStockPage("3")).toBe(3);
    expect(parseStockPage("0")).toBe(1);
    expect(parseStockPage("-2")).toBe(1);
    expect(parseStockPage("abc")).toBe(1);
    expect(parseStockPage(undefined)).toBe(1);
  });
});
