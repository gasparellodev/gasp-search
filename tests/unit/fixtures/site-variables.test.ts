/**
 * Smoke test do factory `makeSiteVariables` (issue #203 / Sprint 0 #F6).
 *
 * Garante que o default passa em `SiteVariables.parse()` — quebra
 * compile-time/runtime se o schema mudar e o fixture não acompanhar.
 */
import { describe, expect, it } from "vitest";

import { makeSiteVariables } from "@/tests/fixtures/site-variables";
import { SiteVariables } from "@/types/lead-site";

describe("makeSiteVariables() factory", () => {
  it("retorna um payload válido por default (passa em SiteVariables.parse)", () => {
    const sv = makeSiteVariables();
    expect(() => SiteVariables.parse(sv)).not.toThrow();
  });

  it("aplica overrides shallow", () => {
    const sv = makeSiteVariables({
      business_name: "Outra Concessionária",
      primary_color: "#ff0000",
    });
    expect(sv.business_name).toBe("Outra Concessionária");
    expect(sv.primary_color).toBe("#ff0000");
    // outros campos preservados
    expect(sv.business_slug).toBe("autostar-veiculos");
  });

  it("retorna instância diferente a cada chamada (sem aliasing)", () => {
    const a = makeSiteVariables();
    const b = makeSiteVariables();
    expect(a).not.toBe(b);
  });
});
