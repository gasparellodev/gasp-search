import { describe, expect, it } from "vitest";

import {
  classifyCar,
  parseCategoriaParam,
} from "@/components/sites/stock/car-categories";

describe("classifyCar", () => {
  it("classifica SUVs por keyword (T-Cross → suv)", () => {
    expect(classifyCar({ brand: "Volkswagen", model: "T-Cross" })).toBe("suv");
  });

  it("classifica picapes (Hilux → picape)", () => {
    expect(classifyCar({ brand: "Toyota", model: "Hilux" })).toBe("picape");
  });

  it("classifica sedans (Corolla → sedan)", () => {
    expect(classifyCar({ brand: "Toyota", model: "Corolla" })).toBe("sedan");
  });

  it("classifica hatches (HB20 → hatch)", () => {
    expect(classifyCar({ brand: "Hyundai", model: "HB20" })).toBe("hatch");
  });

  it("classifica esportivos (Mustang → esportivo)", () => {
    expect(classifyCar({ brand: "Ford", model: "Mustang GT" })).toBe(
      "esportivo",
    );
  });

  it("é case-insensitive e ignora acentos", () => {
    expect(classifyCar({ brand: "TOYOTA", model: "COROLLA" })).toBe("sedan");
    expect(classifyCar({ brand: "Toyota", model: "Sedã" })).toBe("sedan");
  });

  it("retorna null quando nenhuma keyword bate", () => {
    expect(classifyCar({ brand: "Tesla", model: "Modelo Z42" })).toBeNull();
  });
});

describe("parseCategoriaParam", () => {
  it("retorna null para input vazio/null/undefined", () => {
    expect(parseCategoriaParam(null)).toBeNull();
    expect(parseCategoriaParam(undefined)).toBeNull();
    expect(parseCategoriaParam("")).toBeNull();
  });

  it("parseia token único conhecido", () => {
    const result = parseCategoriaParam("sedan");
    expect(result).not.toBeNull();
    expect(result?.has("sedan")).toBe(true);
    expect(result?.size).toBe(1);
  });

  it("parseia CSV multi-token (sedan,suv)", () => {
    const result = parseCategoriaParam("sedan,suv");
    expect(result?.has("sedan")).toBe(true);
    expect(result?.has("suv")).toBe(true);
    expect(result?.size).toBe(2);
  });

  it("descarta tokens inválidos silenciosamente", () => {
    const result = parseCategoriaParam("sedan,foo,xss");
    expect(result?.has("sedan")).toBe(true);
    expect(result?.size).toBe(1);
  });

  it("retorna null quando todos os tokens são inválidos", () => {
    expect(parseCategoriaParam("foo,bar,baz")).toBeNull();
  });

  it("normaliza case e whitespace", () => {
    const result = parseCategoriaParam(" SEDAN , Suv ");
    expect(result?.has("sedan")).toBe(true);
    expect(result?.has("suv")).toBe(true);
  });
});
