import { describe, expect, it } from "vitest";
import { FileText, KeyRound, Search } from "lucide-react";

import { PROCESS_STEPS_TEMPLATE } from "@/lib/sites/process-steps-template";

describe("PROCESS_STEPS_TEMPLATE (issue #223)", () => {
  it("exporta exatamente 3 steps", () => {
    expect(PROCESS_STEPS_TEMPLATE).toHaveLength(3);
  });

  it("step 1 — Search / Escolha seu carro", () => {
    const step = PROCESS_STEPS_TEMPLATE[0];
    expect(step?.icon).toBe(Search);
    expect(step?.title).toBe("Escolha seu carro");
    expect(step?.body).toMatch(/pesquise/i);
    expect(step?.body.length).toBeGreaterThan(20);
  });

  it("step 2 — FileText / Aprovação simples", () => {
    const step = PROCESS_STEPS_TEMPLATE[1];
    expect(step?.icon).toBe(FileText);
    expect(step?.title).toBe("Aprovação simples");
    expect(step?.body).toMatch(/financiamento/i);
  });

  it("step 3 — KeyRound / Leve pra casa", () => {
    const step = PROCESS_STEPS_TEMPLATE[2];
    expect(step?.icon).toBe(KeyRound);
    expect(step?.title).toBe("Leve pra casa");
    expect(step?.body).toMatch(/documenta[çc][ãa]o|garantia/i);
  });

  it("cada step tem shape {icon, title, body}", () => {
    for (const step of PROCESS_STEPS_TEMPLATE) {
      expect(step).toHaveProperty("icon");
      expect(step).toHaveProperty("title");
      expect(step).toHaveProperty("body");
      expect(typeof step.title).toBe("string");
      expect(typeof step.body).toBe("string");
    }
  });
});
