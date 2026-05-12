import { describe, expect, it } from "vitest";

import { WARRANTY_PROCESS } from "@/lib/sites/warranty-process";

describe("WARRANTY_PROCESS", () => {
  it("exporta exatamente 3 passos do processo de garantia", () => {
    expect(WARRANTY_PROCESS).toHaveLength(3);
  });

  it("mantém os títulos canônicos da issue #229", () => {
    expect(WARRANTY_PROCESS.map((step) => step.title)).toEqual([
      "Vistoria 100 pontos",
      "Garantia mecânica de 3 meses",
      "Suporte pós-venda direto",
    ]);
  });

  it("todos os cards têm body PT-BR não vazio e ícone lucide mapeável", () => {
    for (const step of WARRANTY_PROCESS) {
      expect(step.body.trim().length).toBeGreaterThan(20);
      expect(["Search", "ShieldCheck", "Headphones"]).toContain(step.icon);
    }
  });
});
