import { describe, expect, it } from "vitest";
import { searchGoogleMapsSchema } from "@/lib/validators/search";

describe("searchGoogleMapsSchema", () => {
  it("aceita input mínimo para o actor do Google Maps", () => {
    const result = searchGoogleMapsSchema.safeParse({
      searchStringsArray: ["barbearia Curitiba PR"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        searchStringsArray: ["barbearia Curitiba PR"],
        maxCrawledPlacesPerSearch: 50,
        language: "pt-BR",
        countryCode: "br",
      });
    }
  });

  it("trimma termos e rejeita busca vazia", () => {
    const valid = searchGoogleMapsSchema.safeParse({
      searchStringsArray: ["  clínica estética São Paulo  "],
    });
    const invalid = searchGoogleMapsSchema.safeParse({
      searchStringsArray: ["   "],
    });

    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.searchStringsArray).toEqual([
        "clínica estética São Paulo",
      ]);
    }
    expect(invalid.success).toBe(false);
  });

  it("limita volume para evitar requests grandes demais no actor síncrono", () => {
    const result = searchGoogleMapsSchema.safeParse({
      searchStringsArray: ["restaurante"],
      maxCrawledPlacesPerSearch: 501,
    });

    expect(result.success).toBe(false);
  });

  it("normaliza countryCode customizado para minúsculas", () => {
    const result = searchGoogleMapsSchema.safeParse({
      searchStringsArray: ["academia"],
      countryCode: "BR",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.countryCode).toBe("br");
    }
  });
});
