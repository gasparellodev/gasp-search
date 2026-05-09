import { describe, expect, it } from "vitest";

import { renderTemplate } from "@/lib/whatsapp/render-template";

describe("renderTemplate", () => {
  it("substitui um único placeholder pelo valor fornecido", () => {
    const out = renderTemplate("Olá {nome}!", { nome: "Vinicius" });
    expect(out).toBe("Olá Vinicius!");
  });

  it("substitui múltiplos placeholders distintos no mesmo template", () => {
    const out = renderTemplate(
      "Oi {business_name}, prévia em {site_url}",
      { business_name: "Concessionária X", site_url: "https://x.com/site" },
    );
    expect(out).toBe("Oi Concessionária X, prévia em https://x.com/site");
  });

  it("substitui o mesmo placeholder múltiplas vezes", () => {
    const out = renderTemplate("{nome} - {nome} - {nome}", { nome: "A" });
    expect(out).toBe("A - A - A");
  });

  it("lança Error('Missing template variable: <key>') quando a variável não é fornecida", () => {
    expect(() =>
      renderTemplate("Oi {business_name} em {site_url}", {
        business_name: "X",
      }),
    ).toThrow(/Missing template variable: site_url/);
  });

  it("retorna o mesmo texto quando não há placeholders (idempotente em texto plano)", () => {
    const plain = "Texto sem variável nenhuma.";
    expect(renderTemplate(plain, {})).toBe(plain);
  });

  it("retorna string vazia para template vazio", () => {
    expect(renderTemplate("", { foo: "bar" })).toBe("");
  });

  it("aceita valores com caracteres especiais ($, $1, &, etc.) sem interpretar como replace patterns", () => {
    const out = renderTemplate("URL: {url}", {
      url: "https://example.com/path?q=$1&x=$2",
    });
    expect(out).toBe("URL: https://example.com/path?q=$1&x=$2");
  });

  it("aceita valores PT-BR com acentuação preservada", () => {
    const out = renderTemplate("Olá {nome}, tudo bem?", {
      nome: "João Cândido",
    });
    expect(out).toBe("Olá João Cândido, tudo bem?");
  });

  it("aceita valor vazio como substituição válida (não lança)", () => {
    const out = renderTemplate("Antes [{nome}] depois", { nome: "" });
    expect(out).toBe("Antes [] depois");
  });

  it("inclui o nome da variável faltante na mensagem de erro", () => {
    try {
      renderTemplate("{a} {b} {c}", { a: "1", b: "2" });
      throw new Error("expected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe("Missing template variable: c");
    }
  });
});
