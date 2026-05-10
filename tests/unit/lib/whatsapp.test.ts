/**
 * Tests para `lib/whatsapp.ts` (issue #200).
 *
 * Cobre:
 *   - `normalizePhoneBR` happy paths (11+ formatos válidos) e sad paths (6 inválidos).
 *   - `buildWhatsAppLink` 4 templates × variantes opcionais (price/km/carBrand+Model).
 *   - UTM params estrutura determinística + valores fixos.
 *   - Encoding PT-BR byte-exact (acentos).
 *   - Zod schema rejeita input fora dos enums / shape.
 *   - `InvalidPhoneError` PII redaction.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ZodError } from "zod";

import {
  buildWhatsAppLink,
  formatKmBR,
  formatPriceBR,
  InvalidPhoneError,
  normalizePhoneBR,
  type BuildWhatsAppLinkInput,
} from "@/lib/whatsapp";

// ============================================================================
// normalizePhoneBR
// ============================================================================
describe("normalizePhoneBR", () => {
  describe("happy paths — móvel 9 dígitos (resultado 13 chars)", () => {
    const cases: Array<[string, string]> = [
      ["+55 (11) 9 9999-9999", "5511999999999"],
      ["+55 11 99999-9999", "5511999999999"],
      ["+5511999999999", "5511999999999"],
      ["5511999999999", "5511999999999"],
      ["(11) 99999-9999", "5511999999999"],
      ["11 99999-9999", "5511999999999"],
      ["11999999999", "5511999999999"],
      ["(11)99999-9999", "5511999999999"],
      ["11.99999.9999", "5511999999999"],
      ["  +55 11 9 9999 9999  ", "5511999999999"],
      ["+55-11-99999-9999", "5511999999999"],
    ];

    it.each(cases)("normaliza %s → %s", (input, expected) => {
      expect(normalizePhoneBR(input)).toBe(expected);
    });
  });

  describe("happy paths — fixo 8 dígitos (resultado 12 chars)", () => {
    it("(11) 3333-4444 → 551133334444", () => {
      expect(normalizePhoneBR("(11) 3333-4444")).toBe("551133334444");
    });

    it("é idempotente em string já normalizada de fixo", () => {
      expect(normalizePhoneBR("551133334444")).toBe("551133334444");
    });
  });

  describe("happy paths — idempotência com SiteVariables.whatsapp", () => {
    // Schema do projeto: `whatsapp: z.string().regex(/^\d{10,13}$/)` — phone já é
    // só dígitos. `normalizePhoneBR` deve aceitar sem rejeitar.
    it("aceita 5511999999999 idempotente", () => {
      expect(normalizePhoneBR("5511999999999")).toBe("5511999999999");
    });

    it("aceita 11999999999 (sem DDI) e adiciona 55", () => {
      expect(normalizePhoneBR("11999999999")).toBe("5511999999999");
    });
  });

  describe("sad paths — InvalidPhoneError", () => {
    it.each([
      ["", "string vazia"],
      ["telefone", "só letras"],
      ["123", "curto demais"],
      ["11999", "menor que 10 dígitos"],
      ["5511999999999999", "longo demais (>13)"],
      ["00999999999", "DDD 00 (inválido)"],
      ["10999999999", "DDD 10 (inválido)"],
      ["+1 415 555 1234", "DDI estrangeiro (US)"],
    ])("rejeita %s (%s)", (input) => {
      expect(() => normalizePhoneBR(input)).toThrow(InvalidPhoneError);
    });

    it("móvel sem 9º dígito é rejeitado (10 chars com 3o digito ≠9)", () => {
      // 11 + 8888-9999 = 10 dígitos ⇒ é tratado como fixo, OK
      // mas 11 + 88888-9999 (11 chars começando com 8) é móvel inválido
      expect(() => normalizePhoneBR("11888889999")).toThrow(InvalidPhoneError);
    });
  });

  describe("InvalidPhoneError PII redaction", () => {
    it("message contém apenas sufixo ***NNNN", () => {
      try {
        normalizePhoneBR("5511987654321987");  // longo demais
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidPhoneError);
        if (err instanceof InvalidPhoneError) {
          expect(err.message).toBe("Invalid BR phone: ***1987");
          expect(err.suffix).toBe("***1987");
          // raw é preservado pra debugging interno (não logado)
          expect(err.raw).toBe("5511987654321987");
        }
      }
    });

    it("phone curto demais retorna ***<short>", () => {
      try {
        normalizePhoneBR("123");
      } catch (err) {
        if (err instanceof InvalidPhoneError) {
          expect(err.message).toBe("Invalid BR phone: ***<short>");
        }
      }
    });
  });
});

// ============================================================================
// formatPriceBR / formatKmBR
// ============================================================================
describe("formatters BR", () => {
  it("formatPriceBR(49900) = '49.900'", () => {
    expect(formatPriceBR(49900)).toBe("49.900");
  });

  it("formatPriceBR(1689000) = '1.689.000'", () => {
    expect(formatPriceBR(1689000)).toBe("1.689.000");
  });

  it("formatPriceBR(0) = '0'", () => {
    expect(formatPriceBR(0)).toBe("0");
  });

  it("formatKmBR(45000) = '45.000'", () => {
    expect(formatKmBR(45000)).toBe("45.000");
  });
});

// ============================================================================
// buildWhatsAppLink — base structure
// ============================================================================
describe("buildWhatsAppLink — base", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe("template: general", () => {
    const input: BuildWhatsAppLinkInput = {
      template: "general",
      phone: "5511987654321",
      businessName: "Cabral Multimarcas",
      siteSlug: "cabral-multimarcas-x7k2",
      component: "footer",
    };

    it("renderiza link completo com UTM params em ordem determinística", () => {
      const url = buildWhatsAppLink(input);
      expect(url).toBe(
        "https://wa.me/5511987654321?" +
          "text=" +
          encodeURIComponent(
            "Olá! Vi o site da Cabral Multimarcas e gostaria de mais informações.",
          ) +
          "&utm_source=site" +
          "&utm_medium=whatsapp" +
          "&utm_campaign=general" +
          "&utm_content=footer" +
          "&utm_term=cabral-multimarcas-x7k2",
      );
    });

    it("phone inválido lança InvalidPhoneError + warna sem PII completa", () => {
      const bad = { ...input, phone: "+1 415 555 1234" };
      expect(() => buildWhatsAppLink(bad)).toThrow(InvalidPhoneError);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const call = warnSpy.mock.calls[0]!;
      expect(call[0]).toBe(
        "[whatsapp] invalid phone in buildWhatsAppLink",
      );
      expect(call[1]).toEqual({
        component: "footer",
        template: "general",
        phoneSuffix: "***1234",
      });
    });
  });

  describe("template: vehicle", () => {
    const baseVehicleInput: BuildWhatsAppLinkInput = {
      template: "vehicle",
      phone: "5511987654321",
      businessName: "Cabral Multimarcas",
      siteSlug: "cabral-multimarcas-x7k2",
      component: "car-detail",
      vehicle: {
        brand: "BMW",
        model: "M2",
        year: 2023,
        price: 489900,
        carSlug: "bmw-m2-2023-001",
      },
    };

    it("com price renderiza '... (R$ 489.900) ...'", () => {
      const url = buildWhatsAppLink(baseVehicleInput);
      const decoded = decodeURIComponent(
        url.split("text=")[1]!.split("&")[0]!,
      );
      expect(decoded).toBe(
        "Olá! Vi o BMW M2 2023 (R$ 489.900) no site da Cabral Multimarcas e gostaria de mais informações. Ainda está disponível?",
      );
    });

    it("sem price (null) omite parêntese de preço", () => {
      const noPrice: BuildWhatsAppLinkInput = {
        ...baseVehicleInput,
        vehicle: { ...baseVehicleInput.vehicle, price: null },
      };
      const url = buildWhatsAppLink(noPrice);
      const decoded = decodeURIComponent(
        url.split("text=")[1]!.split("&")[0]!,
      );
      expect(decoded).toBe(
        "Olá! Vi o BMW M2 2023 no site da Cabral Multimarcas e gostaria de mais informações. Ainda está disponível?",
      );
    });
  });

  describe("template: tradein", () => {
    const baseTradeInput: BuildWhatsAppLinkInput = {
      template: "tradein",
      phone: "5511987654321",
      businessName: "Cabral Multimarcas",
      siteSlug: "cabral-multimarcas-x7k2",
      component: "advertise-section",
      trade: {
        brand: "Honda",
        model: "Civic",
        year: 2018,
        km: 65000,
      },
    };

    it("com km renderiza '... com 65.000 km ...'", () => {
      const url = buildWhatsAppLink(baseTradeInput);
      const decoded = decodeURIComponent(
        url.split("text=")[1]!.split("&")[0]!,
      );
      expect(decoded).toBe(
        "Olá! Tenho um Honda Civic 2018 com 65.000 km para dar de entrada na Cabral Multimarcas. Vocês avaliam?",
      );
    });

    it("sem km omite o trecho 'com X km'", () => {
      const noKm: BuildWhatsAppLinkInput = {
        ...baseTradeInput,
        trade: { ...baseTradeInput.trade, km: undefined },
      };
      const url = buildWhatsAppLink(noKm);
      const decoded = decodeURIComponent(
        url.split("text=")[1]!.split("&")[0]!,
      );
      expect(decoded).toBe(
        "Olá! Tenho um Honda Civic 2018 para dar de entrada na Cabral Multimarcas. Vocês avaliam?",
      );
    });
  });

  describe("template: financing", () => {
    const baseFinancingInput: BuildWhatsAppLinkInput = {
      template: "financing",
      phone: "5511987654321",
      businessName: "Cabral Multimarcas",
      siteSlug: "cabral-multimarcas-x7k2",
      component: "home-cta",
      finance: {
        carPrice: 79900,
        downPaymentPct: 20,
        months: 60,
        carBrand: "Toyota",
        carModel: "Corolla",
      },
    };

    it("com carBrand+carModel cita o veículo", () => {
      const url = buildWhatsAppLink(baseFinancingInput);
      const decoded = decodeURIComponent(
        url.split("text=")[1]!.split("&")[0]!,
      );
      expect(decoded).toBe(
        "Olá! Simulei o Toyota Corolla no site da Cabral Multimarcas: entrada de 20% em 60x. Pode me enviar uma proposta?",
      );
    });

    it("sem carBrand+carModel cita preço", () => {
      const noCarInfo: BuildWhatsAppLinkInput = {
        ...baseFinancingInput,
        finance: {
          carPrice: 79900,
          downPaymentPct: 20,
          months: 60,
        },
      };
      const url = buildWhatsAppLink(noCarInfo);
      const decoded = decodeURIComponent(
        url.split("text=")[1]!.split("&")[0]!,
      );
      expect(decoded).toBe(
        "Olá! Simulei um financiamento de R$ 79.900 no site da Cabral Multimarcas: entrada de 20% em 60x. Pode me enviar uma proposta?",
      );
    });
  });
});

// ============================================================================
// UTM params + encoding
// ============================================================================
describe("UTM params + encoding", () => {
  const input: BuildWhatsAppLinkInput = {
    template: "general",
    phone: "5511987654321",
    businessName: "Auto Star",
    siteSlug: "auto-star-y3k5",
    component: "header",
  };

  it("ordem dos params: text → utm_source → utm_medium → utm_campaign → utm_content → utm_term", () => {
    const url = buildWhatsAppLink(input);
    const query = url.split("?")[1]!;
    const keys = query.split("&").map((kv) => kv.split("=")[0]);
    expect(keys).toEqual([
      "text",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ]);
  });

  it("utm_source=site, utm_medium=whatsapp são fixos", () => {
    const url = buildWhatsAppLink(input);
    expect(url).toContain("utm_source=site");
    expect(url).toContain("utm_medium=whatsapp");
  });

  it("utm_campaign reflete o template", () => {
    const url = buildWhatsAppLink(input);
    expect(url).toContain("utm_campaign=general");
  });

  it("utm_content reflete o component", () => {
    const url = buildWhatsAppLink(input);
    expect(url).toContain("utm_content=header");
  });

  it("utm_term reflete o siteSlug", () => {
    const url = buildWhatsAppLink(input);
    expect(url).toContain("utm_term=auto-star-y3k5");
  });

  it("acentos PT-BR são encoded byte-exact (Olá → %20Vi → encoding)", () => {
    const url = buildWhatsAppLink(input);
    const text = url.split("text=")[1]!.split("&")[0]!;
    // "Olá!" começa com O+l+á — á é %C3%A1
    expect(text).toContain("Ol%C3%A1");
  });
});

// ============================================================================
// Zod schema rejection
// ============================================================================
describe("BuildWhatsAppLinkInputSchema validation", () => {
  it("rejeita template fora do enum", () => {
    expect(() =>
      buildWhatsAppLink({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        template: "spam" as any,
        phone: "5511999999999",
        businessName: "X",
        siteSlug: "x",
        component: "footer",
      }),
    ).toThrow(ZodError);
  });

  it("rejeita component fora do enum", () => {
    expect(() =>
      buildWhatsAppLink({
        template: "general",
        phone: "5511999999999",
        businessName: "X",
        siteSlug: "x",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component: "spam-banner" as any,
      }),
    ).toThrow(ZodError);
  });

  it("rejeita siteSlug com caracteres inválidos", () => {
    expect(() =>
      buildWhatsAppLink({
        template: "general",
        phone: "5511999999999",
        businessName: "X",
        siteSlug: "Invalid Slug With Caps",
        component: "footer",
      }),
    ).toThrow(ZodError);
  });

  it("rejeita vehicle.year negativo", () => {
    expect(() =>
      buildWhatsAppLink({
        template: "vehicle",
        phone: "5511999999999",
        businessName: "X",
        siteSlug: "x",
        component: "car-detail",
        vehicle: {
          brand: "BMW",
          model: "M2",
          year: -1,
          price: 100,
          carSlug: "bmw-m2",
        },
      }),
    ).toThrow(ZodError);
  });

  it("rejeita financing.downPaymentPct > 100", () => {
    expect(() =>
      buildWhatsAppLink({
        template: "financing",
        phone: "5511999999999",
        businessName: "X",
        siteSlug: "x",
        component: "home-cta",
        finance: {
          carPrice: 100,
          downPaymentPct: 150,
          months: 12,
        },
      }),
    ).toThrow(ZodError);
  });
});
