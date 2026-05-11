/**
 * Smoke test do factory `makeLead` (issue #203 / Sprint 0 #F6).
 *
 * Garante shape mínimo do tipo `Tables<'leads'>` e overrides funcionando.
 * Não há schema Zod runtime para `Lead` (é tipo de DB), então o gate é
 * compile-time + sanidade dos campos básicos.
 */
import { describe, expect, it } from "vitest";

import { makeLead } from "@/tests/fixtures/lead";

describe("makeLead() factory", () => {
  it("retorna um Lead com campos obrigatórios populados", () => {
    const lead = makeLead();
    expect(lead.id).toBeTruthy();
    expect(lead.user_id).toBeTruthy();
    expect(lead.name).toBeTruthy();
    expect(lead.source).toBe("google_maps");
    expect(lead.stage).toBe("new");
    expect(typeof lead.score).toBe("number");
  });

  it("aplica overrides shallow", () => {
    const lead = makeLead({
      name: "Outra Concessionária",
      city: "Porto Alegre",
      stage: "qualified",
    });
    expect(lead.name).toBe("Outra Concessionária");
    expect(lead.city).toBe("Porto Alegre");
    expect(lead.stage).toBe("qualified");
    // não override → mantém default
    expect(lead.state).toBe("SP");
  });

  it("retorna instância diferente a cada chamada", () => {
    expect(makeLead()).not.toBe(makeLead());
  });
});
