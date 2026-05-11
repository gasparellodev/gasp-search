/**
 * Smoke test do factory `makeLeadSite` (issue #203 / Sprint 0 #F6).
 *
 * Garante que `variables` default passa em `SiteVariables.parse()` (que
 * é o contrato real do payload) e overrides funcionam.
 */
import { describe, expect, it } from "vitest";

import { makeLeadSite } from "@/tests/fixtures/lead-site";
import { SiteVariables } from "@/types/lead-site";

describe("makeLeadSite() factory", () => {
  it("retorna um LeadSite com defaults coerentes (status=draft, signed_at=null)", () => {
    const site = makeLeadSite();
    expect(site.status).toBe("draft");
    expect(site.signed_at).toBeNull();
    expect(site.published_at).toBeNull();
    expect(site.archived_at).toBeNull();
    expect(site.view_count).toBe(0);
  });

  it("variables default passa em SiteVariables.parse()", () => {
    const site = makeLeadSite();
    expect(() => SiteVariables.parse(site.variables)).not.toThrow();
  });

  it("aplica overrides shallow (status + timestamps)", () => {
    const site = makeLeadSite({
      status: "published",
      published_at: "2026-05-10T10:00:00.000Z",
      signed_at: "2026-05-09T15:00:00.000Z",
    });
    expect(site.status).toBe("published");
    expect(site.published_at).toBe("2026-05-10T10:00:00.000Z");
    expect(site.signed_at).toBe("2026-05-09T15:00:00.000Z");
    // não override → mantém default
    expect(site.slug).toBe("a1b2c3-autostar-veiculos");
  });
});
