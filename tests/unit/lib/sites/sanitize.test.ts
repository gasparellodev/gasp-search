import { describe, expect, it } from "vitest";

import {
  ANNOUNCEMENT_TEXT_MAX,
  DEFAULT_HEX,
  isLikelyGoogleMapsPhoto,
  safeUrl,
  sanitizeAnnouncementText,
  sanitizeHex,
} from "@/lib/sites/sanitize";

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

describe("sanitizeAnnouncementText() (#291)", () => {
  it("retorna a string trimada quando já está limpa e dentro do limite", () => {
    expect(sanitizeAnnouncementText("Black Friday")).toBe("Black Friday");
  });

  it("aplica trim em whitespace nas pontas", () => {
    expect(sanitizeAnnouncementText("  Promoção  ")).toBe("Promoção");
  });

  it("colapsa whitespace interno (incluindo \\n e \\t) em 1 espaço", () => {
    expect(sanitizeAnnouncementText("Black\n\tFriday   2026")).toBe(
      "Black Friday 2026",
    );
  });

  it("retorna null quando a string é apenas whitespace", () => {
    expect(sanitizeAnnouncementText("   \n\t   ")).toBeNull();
  });

  it("retorna null para string vazia", () => {
    expect(sanitizeAnnouncementText("")).toBeNull();
  });

  it("retorna null para null", () => {
    expect(sanitizeAnnouncementText(null)).toBeNull();
  });

  it("retorna null para undefined", () => {
    expect(sanitizeAnnouncementText(undefined)).toBeNull();
  });

  it("retorna null para não-string (number)", () => {
    expect(sanitizeAnnouncementText(42)).toBeNull();
  });

  it("strippa tags HTML simples preservando conteúdo textual", () => {
    expect(
      sanitizeAnnouncementText("<b>Promoção</b> <i>quente</i>"),
    ).toBe("Promoção quente");
  });

  it("strippa tags com atributos e content malicioso", () => {
    expect(
      sanitizeAnnouncementText(
        'Inicio <script src="evil">alert(1)</script> fim',
      ),
    ).toBe("Inicio alert(1) fim");
  });

  it("retorna null quando o conteúdo só tem tags (strip vira vazio)", () => {
    expect(sanitizeAnnouncementText("<div></div>")).toBeNull();
  });

  it("trunca quando excede ANNOUNCEMENT_TEXT_MAX (140) chars", () => {
    const long = "a".repeat(200);
    const result = sanitizeAnnouncementText(long);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(ANNOUNCEMENT_TEXT_MAX);
  });

  it("não trunca quando o texto cabe em ANNOUNCEMENT_TEXT_MAX (limite exato)", () => {
    const exact = "x".repeat(ANNOUNCEMENT_TEXT_MAX);
    expect(sanitizeAnnouncementText(exact)).toBe(exact);
  });

  it("ANNOUNCEMENT_TEXT_MAX é 140 (espelha schema Zod)", () => {
    expect(ANNOUNCEMENT_TEXT_MAX).toBe(140);
  });
});

describe("isLikelyGoogleMapsPhoto() — heurística de classificação", () => {
  it("detecta lh3.googleusercontent.com (host canônico Maps photos)", () => {
    expect(
      isLikelyGoogleMapsPhoto("https://lh3.googleusercontent.com/places/abc=s256"),
    ).toBe(true);
  });

  it("detecta variações lh4/lh5/lh6.googleusercontent.com", () => {
    for (const host of ["lh4", "lh5", "lh6"]) {
      expect(
        isLikelyGoogleMapsPhoto(`https://${host}.googleusercontent.com/x=s256`),
      ).toBe(true);
    }
  });

  it("detecta maps.googleapis.com (Places API / Static Maps)", () => {
    expect(
      isLikelyGoogleMapsPhoto(
        "https://maps.googleapis.com/maps/api/place/photo?ref=xyz",
      ),
    ).toBe(true);
  });

  it("detecta maps.gstatic.com (assets estáticos Maps)", () => {
    expect(
      isLikelyGoogleMapsPhoto("https://maps.gstatic.com/mapfiles/x.png"),
    ).toBe(true);
  });

  it("retorna false para CDNs alternativos (Vercel Blob, Cloudinary)", () => {
    expect(
      isLikelyGoogleMapsPhoto("https://blob.vercel-storage.com/x.svg"),
    ).toBe(false);
    expect(
      isLikelyGoogleMapsPhoto("https://res.cloudinary.com/demo/image/abc.png"),
    ).toBe(false);
  });

  it("retorna false para data URI / path local", () => {
    expect(
      isLikelyGoogleMapsPhoto("data:image/svg+xml;base64,PHN2Zw=="),
    ).toBe(false);
    expect(isLikelyGoogleMapsPhoto("/assets/logo.svg")).toBe(false);
  });

  it("retorna false para empty/null/undefined/não-string", () => {
    expect(isLikelyGoogleMapsPhoto("")).toBe(false);
    expect(isLikelyGoogleMapsPhoto(null)).toBe(false);
    expect(isLikelyGoogleMapsPhoto(undefined)).toBe(false);
    expect(isLikelyGoogleMapsPhoto(42)).toBe(false);
  });

  it("não confunde subdomínio adversarial (`fake-googleusercontent.com`)", () => {
    expect(
      isLikelyGoogleMapsPhoto("https://fake-googleusercontent.com/x.png"),
    ).toBe(false);
    expect(
      isLikelyGoogleMapsPhoto("https://lh3-googleusercontent.com/x.png"),
    ).toBe(false);
  });
});
