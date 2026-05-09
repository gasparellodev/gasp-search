import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/utils/slug";

describe("slugify()", () => {
  it("converte espaços e caracteres não-alfanuméricos em hífen", () => {
    expect(slugify("Toyota da Rua A!")).toBe("toyota-da-rua-a");
  });

  it("normaliza diacríticos via NFKD", () => {
    expect(slugify("São José")).toBe("sao-jose");
    expect(slugify("Toyotá São Paulo")).toBe("toyota-sao-paulo");
  });

  it("colapsa múltiplos espaços em um único hífen", () => {
    expect(slugify("foo   bar")).toBe("foo-bar");
    expect(slugify("Toyota  do   Recife")).toBe("toyota-do-recife");
  });

  it("remove pontuação trailing/leading", () => {
    expect(slugify("foo!!!")).toBe("foo");
    expect(slugify("!!!Toyota!!!")).toBe("toyota");
  });

  it("colapsa hífens consecutivos", () => {
    expect(slugify("a---b")).toBe("a-b");
    expect(slugify("toyota---recife")).toBe("toyota-recife");
  });

  it("retorna 'lead' como fallback quando input é vazio", () => {
    expect(slugify("")).toBe("lead");
  });

  it("retorna 'lead' como fallback quando input é só emoji", () => {
    expect(slugify("🚗")).toBe("lead");
    expect(slugify("🚗💨")).toBe("lead");
  });

  it("retorna 'lead' quando o resultado seria só hífens", () => {
    expect(slugify("---")).toBe("lead");
  });

  it("preserva números e dígitos", () => {
    expect(slugify("Toyota 2026")).toBe("toyota-2026");
  });

  it("converte caixa alta para minúscula", () => {
    expect(slugify("TOYOTA")).toBe("toyota");
  });
});
