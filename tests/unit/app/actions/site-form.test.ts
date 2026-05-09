import { describe, expect, it } from "vitest";

import { submitSiteForm } from "@/app/actions/site-form";

const validPayload = {
  model: "Toyota Corolla",
  name: "Maria Silva",
  email: "maria@example.com",
  phone: "11987654321",
  lgpd: true as const,
};

describe("submitSiteForm()", () => {
  it("retorna { success: true } com payload válido", async () => {
    const r = await submitSiteForm("site-1", validPayload);
    expect(r).toEqual({ success: true });
  });

  it("retorna erro quando siteId vazio", async () => {
    const r = await submitSiteForm("", validPayload);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toMatch(/siteId/i);
    }
  });

  it("retorna erro quando payload é inválido (email malformado)", async () => {
    const r = await submitSiteForm("site-1", {
      ...validPayload,
      email: "naoeumemail",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toMatch(/email/i);
    }
  });

  it("retorna erro quando lgpd=false (sem consentimento)", async () => {
    const r = await submitSiteForm("site-1", {
      ...validPayload,
      lgpd: false as unknown as true,
    });
    expect(r.success).toBe(false);
  });
});
