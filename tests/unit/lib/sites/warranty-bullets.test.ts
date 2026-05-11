import { describe, expect, it } from "vitest";

import { WARRANTY_BULLETS } from "@/lib/sites/warranty-bullets";

describe("WARRANTY_BULLETS (issue #223)", () => {
  it("exporta exatamente 4 bullets PT-BR", () => {
    expect(WARRANTY_BULLETS).toHaveLength(4);
  });

  it("todos os bullets têm texto não vazio", () => {
    for (const text of WARRANTY_BULLETS) {
      expect(text).toBeTypeOf("string");
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  it("bullet 1 menciona garantia mecânica de 3 meses", () => {
    expect(WARRANTY_BULLETS[0]).toMatch(/garantia mecânica de 3 meses/i);
  });

  it("bullet 2 menciona vistoria 100 pontos", () => {
    expect(WARRANTY_BULLETS[1]).toMatch(/vistoria 100 pontos/i);
  });

  it("bullet 3 menciona documentação", () => {
    expect(WARRANTY_BULLETS[2]).toMatch(/documenta[çc][ãa]o/i);
  });

  it("bullet 4 menciona suporte pós-venda", () => {
    expect(WARRANTY_BULLETS[3]).toMatch(/suporte p[óo]s-venda/i);
  });
});
