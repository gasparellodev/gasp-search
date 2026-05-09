import { describe, expect, it } from "vitest";

import { DEFAULT_HEX, safeUrl, sanitizeHex } from "@/lib/sites/sanitize";

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

  it("retorna fallback para input não-string (number) — defesa contra ts-bypass", () => {
    expect(sanitizeHex(123 as unknown as string)).toBe(DEFAULT_HEX);
  });
});

describe("safeUrl() — issue #159 AC7", () => {
  it("aceita https:// (caso canônico)", () => {
    expect(safeUrl("https://example.com/logo.png")).toBe(
      "https://example.com/logo.png",
    );
  });

  it("aceita http:// (não-restritivo a https em dev)", () => {
    expect(safeUrl("http://example.com")).toBe("http://example.com");
  });

  it("rejeita javascript:alert(1) (proteção contra script injection)", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejeita JAVASCRIPT:alert(1) (case-insensitive)", () => {
    expect(safeUrl("JAVASCRIPT:alert(1)")).toBeNull();
  });

  it("rejeita data:text/html,... (proteção contra data URI XSS)", () => {
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejeita data:image/svg+xml;base64,... (svg pode conter script)", () => {
    expect(safeUrl("data:image/svg+xml;base64,PHN2Zw==")).toBeNull();
  });

  it("rejeita file:///etc/passwd (proteção contra leitura local)", () => {
    expect(safeUrl("file:///etc/passwd")).toBeNull();
  });

  it("rejeita vbscript:msgbox (proteção contra IE legacy)", () => {
    expect(safeUrl("vbscript:msgbox")).toBeNull();
  });

  it("retorna null para input null", () => {
    expect(safeUrl(null)).toBeNull();
  });

  it("retorna null para input undefined", () => {
    expect(safeUrl(undefined)).toBeNull();
  });

  it("retorna null para string vazia", () => {
    expect(safeUrl("")).toBeNull();
  });

  it("retorna null para string sem protocolo (URL inválida)", () => {
    expect(safeUrl("not a url")).toBeNull();
  });

  it("retorna null para protocolo desconhecido (gopher://)", () => {
    expect(safeUrl("gopher://example.com")).toBeNull();
  });

  it("aceita query string e fragment em https", () => {
    expect(safeUrl("https://example.com/p?q=1#frag")).toBe(
      "https://example.com/p?q=1#frag",
    );
  });

  it("retorna null para input não-string (number)", () => {
    // safeUrl tem assinatura `string | null | undefined`, mas defesa em
    // profundidade contra ts-bypass.
    expect(safeUrl(123 as unknown as string)).toBeNull();
  });
});
