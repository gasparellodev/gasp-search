/**
 * Testes unitários para `lib/sites/lgpd-content.ts` (issue #P10).
 *
 * Cobre:
 *  - Retorna exatamente 7 seções.
 *  - Cada seção tem id único e anchor-safe.
 *  - Interpola business_name corretamente.
 *  - Lida graciosamente com email/city/state nulos.
 *  - Fallback de DPO e-mail via slug quando email é null.
 *  - Sanitização: business_name com caracteres potencialmente perigosos
 *    é interpolado como texto puro (não parseado como HTML — proteção
 *    contra XSS depende do React, mas verificamos que o valor não é
 *    alterado/escapado pelo helper).
 */
import { describe, expect, it } from "vitest";

import {
  buildLgpdSections,
  formatUpdateDate,
  type LgpdContentInput,
} from "@/lib/sites/lgpd-content";

const BASE_INPUT: LgpdContentInput = {
  business_name: "Touring Cars",
  email: "contato@touringcars.com.br",
  city: "Recife",
  state: "PE",
  appUrl: "http://localhost:3000",
  slug: "j7k2p9-touring-cars",
};

describe("buildLgpdSections — estrutura", () => {
  it("retorna exatamente 7 seções", () => {
    const sections = buildLgpdSections(BASE_INPUT);
    expect(sections).toHaveLength(7);
  });

  it("cada seção tem id único", () => {
    const sections = buildLgpdSections(BASE_INPUT);
    const ids = sections.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(sections.length);
  });

  it("ids são anchor-safe (apenas letras minúsculas, números e hífens)", () => {
    const sections = buildLgpdSections(BASE_INPUT);
    const anchorSafeRegex = /^[a-z0-9-]+$/;
    for (const s of sections) {
      expect(s.id).toMatch(anchorSafeRegex);
    }
  });

  it("cada seção tem heading não-vazio", () => {
    const sections = buildLgpdSections(BASE_INPUT);
    for (const s of sections) {
      expect(s.heading.trim().length).toBeGreaterThan(0);
    }
  });

  it("cada seção tem ao menos 1 parágrafo", () => {
    const sections = buildLgpdSections(BASE_INPUT);
    for (const s of sections) {
      expect(s.paragraphs.length).toBeGreaterThan(0);
    }
  });
});

describe("buildLgpdSections — interpolação de business_name", () => {
  it("inclui business_name na primeira seção (abertura)", () => {
    const sections = buildLgpdSections(BASE_INPUT);
    const intro = sections[0]!;
    expect(intro.paragraphs[0]).toContain("Touring Cars");
  });

  it("inclui business_name na seção de compartilhamento (§3)", () => {
    const sections = buildLgpdSections(BASE_INPUT);
    const sharing = sections.find((s) => s.id === "compartilhamento-de-dados")!;
    expect(sharing.paragraphs[0]).toContain("Touring Cars");
  });

  it("inclui business_name na seção de DPO (§6)", () => {
    const sections = buildLgpdSections(BASE_INPUT);
    const dpo = sections.find((s) => s.id === "contato-dpo")!;
    expect(dpo.paragraphs[0]).toContain("Touring Cars");
  });

  it("interpola business_name diferente corretamente", () => {
    const sections = buildLgpdSections({
      ...BASE_INPUT,
      business_name: "AutoCenter SP",
    });
    const intro = sections[0]!;
    expect(intro.paragraphs[0]).toContain("AutoCenter SP");
    expect(intro.paragraphs[0]).not.toContain("Touring Cars");
  });
});

describe("buildLgpdSections — campos opcionais (null)", () => {
  it("lida com email null usando fallback DPO via slug", () => {
    const sections = buildLgpdSections({ ...BASE_INPUT, email: null });
    const dpo = sections.find((s) => s.id === "contato-dpo")!;
    const rights = sections.find((s) => s.id === "direitos-do-titular")!;
    // Deve conter e-mail derivado do slug (sem o prefixo nanoid8)
    expect(dpo.paragraphs[1]).toContain("dpo@touring-cars.com.br");
    expect(rights.paragraphs[2]).toContain("dpo@touring-cars.com.br");
  });

  it("lida com city null — omite cidade da localização", () => {
    const sections = buildLgpdSections({ ...BASE_INPUT, city: null, state: null });
    const dpo = sections.find((s) => s.id === "contato-dpo")!;
    // Deve usar "no Brasil" como fallback de localização
    expect(dpo.paragraphs[0]).toContain("no Brasil");
    expect(dpo.paragraphs[0]).not.toContain("Recife");
  });

  it("lida com city não-null mas state null — usa apenas a cidade", () => {
    const sections = buildLgpdSections({ ...BASE_INPUT, state: null });
    const dpo = sections.find((s) => s.id === "contato-dpo")!;
    expect(dpo.paragraphs[0]).toContain("Recife");
    expect(dpo.paragraphs[0]).not.toContain(", PE");
  });

  it("lida com todos os campos opcionais null sem lançar erro", () => {
    expect(() =>
      buildLgpdSections({
        ...BASE_INPUT,
        email: null,
        city: null,
        state: null,
      }),
    ).not.toThrow();
  });
});

describe("buildLgpdSections — LGPD cita lei", () => {
  it("menciona LGPD Lei nº 13.709/2018 na primeira seção", () => {
    const sections = buildLgpdSections(BASE_INPUT);
    const intro = sections[0]!;
    expect(intro.paragraphs[0]).toContain("13.709/2018");
  });
});

describe("buildLgpdSections — seção de cookies", () => {
  it("seção cookies menciona revogação de consentimento", () => {
    const sections = buildLgpdSections(BASE_INPUT);
    const cookies = sections.find((s) => s.id === "cookies")!;
    const cookiesText = cookies.paragraphs.join(" ");
    expect(cookiesText.toLowerCase()).toContain("revogar");
    expect(cookiesText.toLowerCase()).toContain("consentimento");
  });

  it("seção cookies inclui link para a própria página lgpd", () => {
    const sections = buildLgpdSections(BASE_INPUT);
    const cookies = sections.find((s) => s.id === "cookies")!;
    const cookiesText = cookies.paragraphs.join(" ");
    expect(cookiesText).toContain(
      `http://localhost:3000/sites/j7k2p9-touring-cars/lgpd`,
    );
  });
});

describe("buildLgpdSections — sanitização (XSS via business_name)", () => {
  it("interpola business_name com caracteres HTML especiais como texto puro", () => {
    const malicious = '<script>alert("xss")</script>';
    const sections = buildLgpdSections({
      ...BASE_INPUT,
      business_name: malicious,
    });
    // O helper retorna o valor puro — o React é responsável por escapar na renderização.
    // Verificamos que o valor não foi modificado pelo helper (não escapa, não remove).
    const intro = sections[0]!;
    expect(intro.paragraphs[0]).toContain(malicious);
  });
});

describe("formatUpdateDate", () => {
  it("retorna string não-vazia com formato de data pt-BR", () => {
    const date = formatUpdateDate();
    expect(typeof date).toBe("string");
    expect(date.trim().length).toBeGreaterThan(0);
    // Deve conter o ano atual
    expect(date).toContain(String(new Date().getFullYear()));
  });
});
