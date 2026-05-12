/**
 * Unit tests — `detail-faq-templates` (Phase 7 / Sprint 6 / #D3 — issue #228).
 *
 * Template-based FAQ contextual ao veículo renderizado em
 * `/sites/<slug>/estoque/<carSlug>`. Substituições `{brand}`, `{model}`,
 * `{year}` aplicadas em question + answer.
 *
 * AC #228:
 *  - 4-6 perguntas contextuais (sweet spot: 5).
 *  - Substituições determinísticas (zero ambiguidade — sem caracter
 *    especial que precise escape).
 *  - Sem JSON-LD `FAQPage` (anti-pattern Google p/ business sites).
 *  - Snapshot pra defender contra drift de copy.
 */
import { describe, expect, it } from "vitest";

import {
  DETAIL_FAQ_TEMPLATE,
  buildDetailFaqItems,
} from "@/lib/sites/detail-faq-templates";

describe("DETAIL_FAQ_TEMPLATE — templates crus (Detail D3 #228)", () => {
  it("contém entre 4 e 6 entries (sweet spot 5 per AC)", () => {
    expect(DETAIL_FAQ_TEMPLATE.length).toBeGreaterThanOrEqual(4);
    expect(DETAIL_FAQ_TEMPLATE.length).toBeLessThanOrEqual(6);
  });

  it("toda entry tem question + answer não vazios", () => {
    for (const entry of DETAIL_FAQ_TEMPLATE) {
      expect(entry.question.trim()).not.toBe("");
      expect(entry.answer.trim()).not.toBe("");
    }
  });

  it("templates contêm pelo menos um placeholder substituível", () => {
    // Defesa de produto — se algum template não usa NENHUM placeholder,
    // pode ser FAQ genérico da Home no lugar errado.
    const placeholderRe = /\{(brand|model|year)\}/;
    for (const entry of DETAIL_FAQ_TEMPLATE) {
      const both = `${entry.question} ${entry.answer}`;
      expect(both).toMatch(placeholderRe);
    }
  });
});

describe("buildDetailFaqItems — interpolação", () => {
  const car = {
    brand: "Toyota",
    model: "Corolla XEi",
    year: 2022,
  };

  it("retorna mesmo número de items que DETAIL_FAQ_TEMPLATE", () => {
    const items = buildDetailFaqItems(car);
    expect(items.length).toBe(DETAIL_FAQ_TEMPLATE.length);
  });

  it("substitui {brand}, {model} e {year} em question e answer", () => {
    const items = buildDetailFaqItems(car);
    for (const item of items) {
      expect(item.question).not.toMatch(/\{brand\}|\{model\}|\{year\}/);
      expect(item.answer).not.toMatch(/\{brand\}|\{model\}|\{year\}/);
    }
  });

  it("preserva o case original do car (não down-case)", () => {
    const allText = buildDetailFaqItems(car)
      .map((i) => `${i.question} ${i.answer}`)
      .join(" ");
    expect(allText).toContain("Toyota");
    expect(allText).toContain("Corolla XEi");
    expect(allText).toContain("2022");
  });

  it("substitui múltiplas ocorrências do mesmo placeholder", () => {
    // Brand artificial pra detectar substituição global (não apenas primeira).
    const items = buildDetailFaqItems({
      brand: "BMW",
      model: "M2",
      year: 2024,
    });
    for (const item of items) {
      // Nenhum placeholder sobreviveu (mesmo se a string tinha 2+)
      expect(item.question).not.toMatch(/\{(brand|model|year)\}/);
      expect(item.answer).not.toMatch(/\{(brand|model|year)\}/);
    }
  });

  it("funciona com brands contendo caracteres não-ASCII (e.g. Citroën)", () => {
    const items = buildDetailFaqItems({
      brand: "Citroën",
      model: "C4 Cactus",
      year: 2021,
    });
    const allText = items.map((i) => `${i.question} ${i.answer}`).join(" ");
    expect(allText).toContain("Citroën");
  });

  it("snapshot — defesa contra drift de copy (PT-BR)", () => {
    const items = buildDetailFaqItems(car);
    expect(items).toMatchSnapshot();
  });

  it("é puro — chamadas repetidas retornam dados estruturalmente iguais", () => {
    const a = buildDetailFaqItems(car);
    const b = buildDetailFaqItems(car);
    expect(a).toEqual(b);
  });
});
