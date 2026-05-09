import { describe, expect, it } from "vitest";

import { DEFAULT_HEX, sanitizeHex } from "@/lib/sites/sanitize";

describe("sanitizeHex()", () => {
  it("retorna a cor quando input válido em maiúsculas (#FF5733)", () => {
    expect(sanitizeHex("#FF5733")).toBe("#FF5733");
  });

  it("retorna a cor quando input válido em minúsculas (#0c0c0c)", () => {
    expect(sanitizeHex("#0c0c0c")).toBe("#0c0c0c");
  });

  it("retorna fallback quando input é nome de cor CSS (red)", () => {
    expect(sanitizeHex("red")).toBe(DEFAULT_HEX);
  });

  it("retorna fallback para tentativa de XSS via javascript: (proteção CSS injection)", () => {
    expect(sanitizeHex("javascript:alert(1)")).toBe(DEFAULT_HEX);
  });

  it("retorna fallback para hex curto (#fff)", () => {
    expect(sanitizeHex("#fff")).toBe(DEFAULT_HEX);
  });

  it("retorna fallback para hex de 8 chars com alpha (#FF5733AA)", () => {
    expect(sanitizeHex("#FF5733AA")).toBe(DEFAULT_HEX);
  });

  it("retorna fallback para string vazia", () => {
    expect(sanitizeHex("")).toBe(DEFAULT_HEX);
  });

  it("retorna fallback para hex sem #", () => {
    expect(sanitizeHex("FF5733")).toBe(DEFAULT_HEX);
  });

  it("retorna fallback para input com espaço/aspas (tentativa de break-out)", () => {
    expect(sanitizeHex('#FF5733; background: url("x")')).toBe(DEFAULT_HEX);
  });

  it("DEFAULT_HEX é #0C0C0C (preto puro do design system)", () => {
    expect(DEFAULT_HEX).toBe("#0C0C0C");
  });
});
