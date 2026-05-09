import { describe, expect, it } from "vitest";

import { SiteFormSchema } from "@/lib/sites/site-form.schema";

const validBase = {
  model: "Toyota Corolla 2020",
  name: "Maria Silva",
  email: "maria@example.com",
  phone: "(11) 98765-4321",
  lgpd: true,
};

describe("SiteFormSchema", () => {
  it("aceita payload válido", () => {
    const r = SiteFormSchema.safeParse(validBase);
    expect(r.success).toBe(true);
  });

  it("rejeita modelo vazio", () => {
    const r = SiteFormSchema.safeParse({ ...validBase, model: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "model")).toBe(true);
    }
  });

  it("rejeita nome vazio", () => {
    const r = SiteFormSchema.safeParse({ ...validBase, name: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "name")).toBe(true);
    }
  });

  it("rejeita email malformado", () => {
    const r = SiteFormSchema.safeParse({ ...validBase, email: "naoeumemail" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "email")).toBe(true);
    }
  });

  it("rejeita telefone vazio", () => {
    const r = SiteFormSchema.safeParse({ ...validBase, phone: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "phone")).toBe(true);
    }
  });

  it("rejeita telefone com menos de 10 dígitos", () => {
    const r = SiteFormSchema.safeParse({ ...validBase, phone: "123" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "phone")).toBe(true);
    }
  });

  it("rejeita lgpd=false (consentimento obrigatório)", () => {
    const r = SiteFormSchema.safeParse({ ...validBase, lgpd: false });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "lgpd")).toBe(true);
    }
  });

  it("aceita telefone com formatação brasileira", () => {
    const r = SiteFormSchema.safeParse({
      ...validBase,
      phone: "+55 (11) 98765-4321",
    });
    expect(r.success).toBe(true);
  });
});
