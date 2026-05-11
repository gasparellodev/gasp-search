import { describe, expect, it } from "vitest";

import { FAQ_TEMPLATE } from "@/lib/sites/faq-template";

describe("FAQ_TEMPLATE (issue #223)", () => {
  it("exporta entre 7 e 10 perguntas (range PO refinement)", () => {
    expect(FAQ_TEMPLATE.length).toBeGreaterThanOrEqual(7);
    expect(FAQ_TEMPLATE.length).toBeLessThanOrEqual(10);
  });

  it("toda entry tem {question, answer} string não vazias", () => {
    for (const entry of FAQ_TEMPLATE) {
      expect(typeof entry.question).toBe("string");
      expect(typeof entry.answer).toBe("string");
      expect(entry.question.trim().length).toBeGreaterThan(0);
      expect(entry.answer.trim().length).toBeGreaterThan(0);
    }
  });

  it("questions terminam com '?'", () => {
    for (const entry of FAQ_TEMPLATE) {
      expect(entry.question.trim().endsWith("?")).toBe(true);
    }
  });

  it("FAQ inclui pergunta sobre financiamento (smoke check de relevância)", () => {
    const hasFinancing = FAQ_TEMPLATE.some(
      (e) =>
        /financia[mn]/i.test(e.question) ||
        /financia[mn]/i.test(e.answer),
    );
    expect(hasFinancing).toBe(true);
  });

  it("FAQ inclui pergunta sobre garantia", () => {
    const hasWarranty = FAQ_TEMPLATE.some(
      (e) => /garantia/i.test(e.question) || /garantia/i.test(e.answer),
    );
    expect(hasWarranty).toBe(true);
  });
});
