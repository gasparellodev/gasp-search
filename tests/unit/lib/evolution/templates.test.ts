import { describe, expect, it } from "vitest";
import type { LeadForMessage } from "@/lib/ai/anthropic";
import {
  renderTemplate,
  SUPPORTED_PLACEHOLDERS,
  validateTemplate,
} from "@/lib/evolution/templates";

const fullLead: LeadForMessage = {
  name: "Barbearia do João",
  source: "google_maps",
  category: "Barbearia",
  city: "São Paulo",
  state: "SP",
  country: "Brasil",
  phone: "1133334444",
  email: "joao@example.com",
  website: "https://barbearia.exemplo.com",
  instagram_handle: "barbeariadojoao",
  whatsapp: "5511999998888",
  has_website: true,
  rating: 4.8,
  reviews_count: 120,
  followers_count: null,
  stage: "new",
  score: 80,
  notes: null,
};

describe("renderTemplate", () => {
  it("substitui placeholders básicos pelo valor do lead", () => {
    const out = renderTemplate(
      "Olá {{nome}}, vi sua {{categoria}} em {{cidade}}/{{estado}}.",
      fullLead,
    );
    expect(out).toBe("Olá Barbearia do João, vi sua Barbearia em São Paulo/SP.");
  });

  it("renderiza rating como string e website inteiro", () => {
    const out = renderTemplate(
      "Nota {{rating}} — site {{website}}",
      fullLead,
    );
    expect(out).toBe("Nota 4.8 — site https://barbearia.exemplo.com");
  });

  it("usa whatsapp como telefone preferencial e cai pra phone", () => {
    expect(renderTemplate("{{telefone}}", fullLead)).toBe("5511999998888");
    expect(
      renderTemplate("{{telefone}}", {
        ...fullLead,
        whatsapp: null,
      } as LeadForMessage),
    ).toBe("1133334444");
    expect(
      renderTemplate("{{telefone}}", {
        ...fullLead,
        whatsapp: null,
        phone: null,
      } as LeadForMessage),
    ).toBe("");
  });

  it("placeholder de campo null vira string vazia", () => {
    const lead = { ...fullLead, city: null, rating: null } as LeadForMessage;
    expect(renderTemplate("{{cidade}}/{{rating}}", lead)).toBe("/");
  });

  it("aceita espaços dentro das chaves e é case-insensitive", () => {
    expect(renderTemplate("{{ NOME }}", fullLead)).toBe("Barbearia do João");
    expect(renderTemplate("{{Cidade}}", fullLead)).toBe("São Paulo");
  });

  it("placeholders desconhecidos ficam literais no texto", () => {
    expect(renderTemplate("Oi {{xpto}}", fullLead)).toBe("Oi {{xpto}}");
  });

  it("ignora chaves mal formadas (não fazem injeção)", () => {
    expect(renderTemplate("{nome}}", fullLead)).toBe("{nome}}");
    expect(renderTemplate("{{nome}", fullLead)).toBe("{{nome}");
    expect(renderTemplate("{{ {{nome}} }}", fullLead)).toBe(
      "{{ Barbearia do João }}",
    );
  });

  it("texto sem placeholders volta inalterado", () => {
    expect(renderTemplate("Sem variáveis aqui!", fullLead)).toBe(
      "Sem variáveis aqui!",
    );
  });
});

describe("validateTemplate (extractPlaceholders interno)", () => {
  // `extractPlaceholders` virou private em #138a — não tinha importer
  // externo (era dead-export). Garantimos via `validateTemplate` que a
  // extração interna mantém dedup/lowercase/ordenação que ela espera.
  it("dedupe e lowercase ao listar desconhecidos", () => {
    const r = validateTemplate("{{NOME}} {{xpto}} {{Xpto}} {{Outro}}");
    expect(r.unknownPlaceholders).toEqual(["outro", "xpto"]);
  });

  it("valid=true quando todos placeholders são suportados", () => {
    const r = validateTemplate("Olá {{nome}} de {{cidade}}");
    expect(r.valid).toBe(true);
    expect(r.unknownPlaceholders).toEqual([]);
  });

  it("valid=false e lista os desconhecidos", () => {
    const r = validateTemplate("Olá {{nome}} {{xpto}} {{outro}}");
    expect(r.valid).toBe(false);
    expect(r.unknownPlaceholders).toEqual(["outro", "xpto"]);
  });

  it("ignora maiúsculas", () => {
    const r = validateTemplate("{{NOME}} {{Foo}}");
    expect(r.unknownPlaceholders).toEqual(["foo"]);
  });
});

describe("SUPPORTED_PLACEHOLDERS", () => {
  it("contém os 7 placeholders esperados", () => {
    expect([...SUPPORTED_PLACEHOLDERS]).toEqual([
      "nome",
      "cidade",
      "estado",
      "categoria",
      "rating",
      "website",
      "telefone",
    ]);
  });
});
