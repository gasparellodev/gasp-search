import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema } from "@/lib/validators/auth";

describe("signInSchema", () => {
  it("aceita email + senha válidos", () => {
    const r = signInSchema.safeParse({
      email: "vini@gasplab.com",
      password: "minhasenha",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita email inválido", () => {
    const r = signInSchema.safeParse({ email: "invalid", password: "12345678" });
    expect(r.success).toBe(false);
  });

  it("rejeita senha curta", () => {
    const r = signInSchema.safeParse({ email: "a@b.com", password: "short" });
    expect(r.success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("aceita nome + email + senha", () => {
    const r = signUpSchema.safeParse({
      fullName: "Vini",
      email: "v@b.com",
      password: "longsenha",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita nome curto", () => {
    const r = signUpSchema.safeParse({
      fullName: "X",
      email: "v@b.com",
      password: "longsenha",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita nome muito longo", () => {
    const r = signUpSchema.safeParse({
      fullName: "A".repeat(81),
      email: "v@b.com",
      password: "longsenha",
    });
    expect(r.success).toBe(false);
  });
});
