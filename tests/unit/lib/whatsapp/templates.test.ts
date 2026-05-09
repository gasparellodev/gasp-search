import { describe, expect, it } from "vitest";

import { renderTemplate } from "@/lib/whatsapp/render-template";
import {
  SITE_PREVIEW_TEMPLATE,
  TEMPLATE_VARIABLES,
} from "@/lib/whatsapp/templates";

describe("SITE_PREVIEW_TEMPLATE", () => {
  it("contém o placeholder {business_name}", () => {
    expect(SITE_PREVIEW_TEMPLATE).toMatch(/\{business_name\}/);
  });

  it("contém o placeholder {site_url}", () => {
    expect(SITE_PREVIEW_TEMPLATE).toMatch(/\{site_url\}/);
  });

  it("é em português brasileiro (contém pelo menos uma palavra característica)", () => {
    // heurística simples: pelo menos uma palavra PT-BR comum
    expect(SITE_PREVIEW_TEMPLATE).toMatch(/\b(Oi|prévia|você|posso|publicar)\b/i);
  });

  it("renderiza corretamente quando todas as variáveis são fornecidas", () => {
    const out = renderTemplate(SITE_PREVIEW_TEMPLATE, {
      business_name: "AutoCenter SP",
      site_url: "https://gasplab.app/sites/autocenter-sp",
    });
    expect(out).toContain("AutoCenter SP");
    expect(out).toContain("https://gasplab.app/sites/autocenter-sp");
    // Não deve restar placeholders
    expect(out).not.toMatch(/\{business_name\}/);
    expect(out).not.toMatch(/\{site_url\}/);
  });

  it("lança quando uma das variáveis declaradas em TEMPLATE_VARIABLES não é fornecida", () => {
    expect(() =>
      renderTemplate(SITE_PREVIEW_TEMPLATE, {
        business_name: "X",
      }),
    ).toThrow(/Missing template variable: site_url/);
  });
});

describe("TEMPLATE_VARIABLES", () => {
  it("é um array readonly com todas as variáveis usadas no SITE_PREVIEW_TEMPLATE", () => {
    expect(TEMPLATE_VARIABLES).toContain("business_name");
    expect(TEMPLATE_VARIABLES).toContain("site_url");
  });

  it("toda variável declarada aparece como placeholder no template", () => {
    for (const key of TEMPLATE_VARIABLES) {
      const re = new RegExp(`\\{${key}\\}`);
      expect(SITE_PREVIEW_TEMPLATE).toMatch(re);
    }
  });

  it("toda variável é uma chave snake_case válida", () => {
    for (const key of TEMPLATE_VARIABLES) {
      expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});
