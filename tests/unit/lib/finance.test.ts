/**
 * Tests para `lib/finance.ts` (Sprint 0 / #F4 — issue #201).
 *
 * Cobertura:
 *   - `calculateInstallment` — formula PRICE, edge cases, throws.
 *   - `formatBRL` — defaults + fractionDigits custom.
 *   - `slugifyVehicle` — normalização, acentos, hífens, round-trip com `SiteCar.slug`.
 */

import { describe, expect, it } from "vitest";

import {
  calculateInstallment,
  formatBRL,
  slugifyVehicle,
  DEFAULT_MONTHLY_INTEREST,
  DEFAULT_CARD_INSTALLMENT_MONTHS,
  DEFAULT_CARD_DOWN_PCT,
  DISCLAIMER_TEXT,
} from "@/lib/finance";
import { SiteCar } from "@/types/lead-site";

describe("DEFAULT constants", () => {
  it("exporta DEFAULT_MONTHLY_INTEREST = 0.0199 (1.99% a.m.)", () => {
    expect(DEFAULT_MONTHLY_INTEREST).toBe(0.0199);
  });

  it("exporta defaults de card para reuso (H2 widget)", () => {
    expect(DEFAULT_CARD_INSTALLMENT_MONTHS).toBe(48);
    expect(DEFAULT_CARD_DOWN_PCT).toBe(20);
  });
});

describe("calculateInstallment", () => {
  describe("PRICE formula — taxa default 1.99% a.m.", () => {
    it("price=50000 / down=30% / 48m → ~1138.74 installment", () => {
      // financed = 50000 × 0.7 = 35000
      // i = 0.0199, n = 48 → factor = (1.0199)^48 ≈ 2.5712
      // installment = 35000 × (0.0199 × 2.5712) / (2.5712 − 1) ≈ 1138.74
      const result = calculateInstallment({
        price: 50000,
        downPaymentPct: 30,
        months: 48,
      });
      expect(result.financed).toBe(35000);
      expect(result.installment).toBeCloseTo(1138.74, 1);
      expect(result.total).toBeCloseTo(
        result.installment * 48 + 50000 * 0.3,
        1,
      );
    });

    it("price=80000 / down=20% / 60m → installment positivo", () => {
      const result = calculateInstallment({
        price: 80000,
        downPaymentPct: 20,
        months: 60,
      });
      expect(result.financed).toBe(64000);
      expect(result.installment).toBeGreaterThan(0);
      expect(result.installment).toBeLessThan(64000);
      expect(result.total).toBeGreaterThan(80000); // juros somam
    });

    it("price=30000 / down=0% / 12m → installment cobre todo o valor + juros", () => {
      const result = calculateInstallment({
        price: 30000,
        downPaymentPct: 0,
        months: 12,
      });
      expect(result.financed).toBe(30000);
      expect(result.installment).toBeGreaterThan(2500); // mínimo sem juros
      expect(result.total).toBeGreaterThan(30000);
    });
  });

  describe("taxa custom", () => {
    it("aceita monthlyInterest=0 (sem juros) — installment = financed/months", () => {
      const result = calculateInstallment({
        price: 12000,
        downPaymentPct: 0,
        months: 12,
        monthlyInterest: 0,
      });
      expect(result.financed).toBe(12000);
      expect(result.installment).toBe(1000);
      expect(result.total).toBe(12000);
    });

    it("aceita monthlyInterest=0.03 (3% a.m.)", () => {
      const result = calculateInstallment({
        price: 50000,
        downPaymentPct: 30,
        months: 48,
        monthlyInterest: 0.03,
      });
      expect(result.installment).toBeGreaterThan(
        calculateInstallment({
          price: 50000,
          downPaymentPct: 30,
          months: 48,
        }).installment,
      );
    });
  });

  describe("downPaymentPct edge cases", () => {
    it("downPct=100 → financed=0, installment=0, total=price", () => {
      const result = calculateInstallment({
        price: 50000,
        downPaymentPct: 100,
        months: 48,
      });
      expect(result.financed).toBe(0);
      expect(result.installment).toBe(0);
      expect(result.total).toBe(50000);
    });
  });

  describe("zero price", () => {
    it("price=0 → tudo 0, sem throw", () => {
      const result = calculateInstallment({
        price: 0,
        downPaymentPct: 30,
        months: 48,
      });
      expect(result.financed).toBe(0);
      expect(result.installment).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe("throws", () => {
    it("price negativo → RangeError", () => {
      expect(() =>
        calculateInstallment({
          price: -100,
          downPaymentPct: 30,
          months: 48,
        }),
      ).toThrow(RangeError);
    });

    it("downPaymentPct < 0 → RangeError", () => {
      expect(() =>
        calculateInstallment({
          price: 50000,
          downPaymentPct: -10,
          months: 48,
        }),
      ).toThrow(RangeError);
    });

    it("downPaymentPct > 100 → RangeError", () => {
      expect(() =>
        calculateInstallment({
          price: 50000,
          downPaymentPct: 150,
          months: 48,
        }),
      ).toThrow(RangeError);
    });

    it("months <= 0 → RangeError", () => {
      expect(() =>
        calculateInstallment({
          price: 50000,
          downPaymentPct: 30,
          months: 0,
        }),
      ).toThrow(RangeError);
    });

    it("months não-inteiro → RangeError", () => {
      expect(() =>
        calculateInstallment({
          price: 50000,
          downPaymentPct: 30,
          months: 12.5,
        }),
      ).toThrow(RangeError);
    });

    it("monthlyInterest negativo → RangeError", () => {
      expect(() =>
        calculateInstallment({
          price: 50000,
          downPaymentPct: 30,
          months: 48,
          monthlyInterest: -0.01,
        }),
      ).toThrow(RangeError);
    });
  });
});

describe("formatBRL", () => {
  it("default sem decimais — R$ 50000 → 'R$ 50.000'", () => {
    expect(formatBRL(50000)).toMatch(/^R\$\s?50\.000$/);
  });

  it("formata 0 como 'R$ 0'", () => {
    expect(formatBRL(0)).toMatch(/^R\$\s?0$/);
  });

  it("formata valores grandes — R$ 999.999", () => {
    expect(formatBRL(999999)).toMatch(/^R\$\s?999\.999$/);
  });

  it("permite valor negativo (caso total - downPayment dê negativo)", () => {
    // Não deve throw; Intl formata como -R$ X
    expect(() => formatBRL(-100)).not.toThrow();
    expect(formatBRL(-100)).toContain("100");
  });

  it("default arredonda decimais — 1500.50 → 'R$ 1.501'", () => {
    // maximumFractionDigits: 0 → arredondamento half-to-even
    const out = formatBRL(1500.5);
    expect(out).toMatch(/R\$\s?1\.50[01]/);
  });

  it("aceita fractionDigits custom — 1500.50, {fractionDigits:2} → 'R$ 1.500,50'", () => {
    expect(formatBRL(1500.5, { fractionDigits: 2 })).toMatch(
      /^R\$\s?1\.500,50$/,
    );
  });

  it("fractionDigits=2 em valor inteiro mostra ,00", () => {
    expect(formatBRL(1000, { fractionDigits: 2 })).toMatch(
      /^R\$\s?1\.000,00$/,
    );
  });
});

describe("slugifyVehicle", () => {
  it("brand simples — Toyota Corolla 2022 → 'toyota-corolla-2022'", () => {
    expect(
      slugifyVehicle({ brand: "Toyota", model: "Corolla", year: 2022 }),
    ).toBe("toyota-corolla-2022");
  });

  it("strip acentos — Citroën C3 2020 → 'citroen-c3-2020'", () => {
    expect(
      slugifyVehicle({ brand: "Citroën", model: "C3", year: 2020 }),
    ).toBe("citroen-c3-2020");
  });

  it("preserva hífen em brand — Mercedes-Benz Classe A 2021", () => {
    expect(
      slugifyVehicle({
        brand: "Mercedes-Benz",
        model: "Classe A",
        year: 2021,
      }),
    ).toBe("mercedes-benz-classe-a-2021");
  });

  it("colapsa múltiplos espaços", () => {
    expect(
      slugifyVehicle({ brand: "VW", model: "Up  TSI", year: 2019 }),
    ).toBe("vw-up-tsi-2019");
  });

  it("model com número — Audi A1 2020", () => {
    expect(
      slugifyVehicle({ brand: "Audi", model: "A1", year: 2020 }),
    ).toBe("audi-a1-2020");
  });

  it("model com número (3-digit) — Peugeot 308 2018", () => {
    expect(
      slugifyVehicle({ brand: "Peugeot", model: "308", year: 2018 }),
    ).toBe("peugeot-308-2018");
  });

  it("strip caracteres especiais (#, %, .)", () => {
    expect(
      slugifyVehicle({ brand: "Fiat", model: "Punto 1.4", year: 2015 }),
    ).toBe("fiat-punto-1-4-2015");
  });

  it("trim trailing/leading hífens", () => {
    expect(
      slugifyVehicle({ brand: " - Honda - ", model: "Civic", year: 2020 }),
    ).toBe("honda-civic-2020");
  });

  it("round-trip — saída passa em SiteCar.slug regex", () => {
    const inputs = [
      { brand: "Citroën", model: "C3", year: 2020 },
      { brand: "Mercedes-Benz", model: "Classe A", year: 2021 },
      { brand: "Fiat", model: "Punto 1.4", year: 2015 },
      { brand: "VW", model: "Up  TSI", year: 2019 },
    ];
    for (const input of inputs) {
      const slug = slugifyVehicle(input);
      const parsed = SiteCar.shape.slug.safeParse(slug);
      expect(parsed.success).toBe(true);
    }
  });
});

describe("DISCLAIMER_TEXT", () => {
  it("exporta string PT-BR alinhada com CDC + Bacen", () => {
    expect(DISCLAIMER_TEXT).toBe(
      "Sujeito a aprovação de crédito. Taxas variam conforme análise de crédito.",
    );
  });

  it("é uma string não-vazia (usável em React children sem checagem extra)", () => {
    expect(typeof DISCLAIMER_TEXT).toBe("string");
    expect(DISCLAIMER_TEXT.length).toBeGreaterThan(0);
  });

  it("menciona aprovação de crédito (compliance CDC art. 52)", () => {
    expect(DISCLAIMER_TEXT.toLowerCase()).toContain("aprovação de crédito");
  });
});
