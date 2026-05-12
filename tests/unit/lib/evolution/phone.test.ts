import { describe, expect, it } from "vitest";

import { normalizePhone } from "@/lib/evolution/phone";

describe("normalizePhone", () => {
  it("retorna null quando input é null/undefined/vazio", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("retorna null quando não há dígitos (só letras/símbolos)", () => {
    expect(normalizePhone("abcd")).toBeNull();
    expect(normalizePhone("()-+")).toBeNull();
    expect(normalizePhone("phone")).toBeNull();
  });

  it("remove caracteres não-numéricos preservando dígitos", () => {
    expect(normalizePhone("+55 (11) 99999-8888")).toBe("5511999998888");
    expect(normalizePhone(" 11 9999-8888 ")).toBe("1199998888");
  });

  it("aceita números com 8 dígitos (limite inferior)", () => {
    expect(normalizePhone("12345678")).toBe("12345678");
  });

  it("aceita números com 15 dígitos (limite superior E.164)", () => {
    expect(normalizePhone("123456789012345")).toBe("123456789012345");
  });

  it("rejeita números com menos de 8 dígitos", () => {
    expect(normalizePhone("1234567")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("(11) 1")).toBeNull();
  });

  it("rejeita números com mais de 15 dígitos", () => {
    expect(normalizePhone("1234567890123456")).toBeNull();
    expect(normalizePhone("1".repeat(20))).toBeNull();
  });

  it("aceita brasileiros com código país (+55) e sem", () => {
    // Com DDI 55 (E.164): 13 dígitos
    expect(normalizePhone("+55 11 99999-8888")).toBe("5511999998888");
    // Sem DDI, com 9 (celular): 11 dígitos
    expect(normalizePhone("(11) 99999-8888")).toBe("11999998888");
    // Sem DDI, sem 9 (fixo): 10 dígitos
    expect(normalizePhone("(11) 3333-4444")).toBe("1133334444");
  });
});
