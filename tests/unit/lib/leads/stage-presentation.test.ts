import { describe, expect, it } from "vitest";

import {
  STAGE_ACCENT,
  STAGE_LABEL,
  STAGE_VARIANT,
} from "@/lib/leads/stage-presentation";
import { LEAD_STAGES, type LeadStage } from "@/lib/validators/leads";

describe("STAGE_LABEL", () => {
  it("define um label PT-BR para cada estágio", () => {
    for (const stage of LEAD_STAGES) {
      expect(STAGE_LABEL[stage]).toEqual(expect.any(String));
      expect(STAGE_LABEL[stage].length).toBeGreaterThan(0);
    }
  });

  it("mantém os valores canônicos consumidos pelos 5 surfaces (board, table, drawer, dashboard, filters)", () => {
    expect(STAGE_LABEL).toStrictEqual({
      new: "Novo",
      contacted: "Contatado",
      in_conversation: "Em conversa",
      qualified: "Qualificado",
      closed_won: "Ganho",
      closed_lost: "Perdido",
    } satisfies Record<LeadStage, string>);
  });
});

describe("STAGE_VARIANT", () => {
  it("define uma variante de Badge para cada estágio", () => {
    const allowed: ReadonlySet<string> = new Set([
      "default",
      "secondary",
      "outline",
      "destructive",
    ]);
    for (const stage of LEAD_STAGES) {
      expect(allowed.has(STAGE_VARIANT[stage])).toBe(true);
    }
  });

  it("preserva o mapping atual da LeadsTable (semantic colors)", () => {
    expect(STAGE_VARIANT).toStrictEqual({
      new: "secondary",
      contacted: "outline",
      in_conversation: "outline",
      qualified: "default",
      closed_won: "default",
      closed_lost: "destructive",
    });
  });
});

describe("STAGE_ACCENT", () => {
  it("define uma classe Tailwind border-l para cada estágio", () => {
    for (const stage of LEAD_STAGES) {
      expect(STAGE_ACCENT[stage]).toMatch(/^border-l-/);
    }
  });

  it("preserva os accents originais do PipelineBoard", () => {
    expect(STAGE_ACCENT).toStrictEqual({
      new: "border-l-sky-400",
      contacted: "border-l-amber-400",
      in_conversation: "border-l-violet-400",
      qualified: "border-l-emerald-400",
      closed_won: "border-l-emerald-600",
      closed_lost: "border-l-rose-500",
    });
  });
});
