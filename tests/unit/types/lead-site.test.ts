/**
 * Cobre AC1–AC7 do issue #154.
 *
 * Matriz spec-driven: para cada campo de §4 com constraint não-trivial
 * (regex, enum, length, range, nullable), há ≥1 caso `pass` e ≥1 caso `fail`.
 * Failure modes (AC4): campo ausente, valor inválido, e `safeParse()` retornando
 * `success: false` com `error.issues.length >= 1`.
 */

import { describe, expect, it } from "vitest";
import {
  SITE_STOCK_MAX_CARS,
  type SiteCar,
  type SiteCopy,
  type SiteCopyCar,
  type SiteVariables,
  SiteCar as SiteCarSchema,
  SiteCopyCar as SiteCopyCarSchema,
  SiteCopySchema,
  SiteVariables as SiteVariablesSchema,
} from "@/types/lead-site";
import {
  validSiteCopyFixture,
  validSiteVariablesFixture,
} from "@/tests/fixtures/site-variables";

// ---------------------------------------------------------------------------
// Helpers — clones tipados para mutação imutável dos fixtures
// ---------------------------------------------------------------------------

const cloneVars = (): SiteVariables =>
  JSON.parse(JSON.stringify(validSiteVariablesFixture)) as SiteVariables;

const cloneCopy = (): SiteCopy =>
  JSON.parse(JSON.stringify(validSiteCopyFixture)) as SiteCopy;

const cloneCar = (): SiteCar =>
  JSON.parse(
    JSON.stringify(validSiteVariablesFixture.cars[0]),
  ) as SiteCar;

const cloneCopyCar = (): SiteCopyCar =>
  JSON.parse(
    JSON.stringify(validSiteCopyFixture.cars[0]),
  ) as SiteCopyCar;

// expectFailureAtPath: garante que `safeParse` falhou com ≥1 issue contendo
// `segment` no path. Cobre AC4 e a parte "no path correto" do erro.
function expectFailureAtPath(
  schema: { safeParse: (input: unknown) => { success: boolean; error?: { issues: { path: ReadonlyArray<PropertyKey> }[] } } },
  input: unknown,
  segment: PropertyKey,
) {
  const result = schema.safeParse(input);
  expect(result.success).toBe(false);
  if (result.success) return;
  expect(result.error?.issues.length ?? 0).toBeGreaterThanOrEqual(1);
  const matched = result.error?.issues.some((issue) =>
    issue.path.includes(segment),
  );
  expect(matched).toBe(true);
}

// ===========================================================================
// AC1 — Fixtures válidos parseiam
// ===========================================================================

describe("AC1 — fixtures válidos parseiam", () => {
  it("SiteVariables.parse(validSiteVariablesFixture) não lança", () => {
    expect(() =>
      SiteVariablesSchema.parse(validSiteVariablesFixture),
    ).not.toThrow();
  });

  it("SiteCopySchema.parse(validSiteCopyFixture) não lança", () => {
    expect(() => SiteCopySchema.parse(validSiteCopyFixture)).not.toThrow();
  });

  it("safeParse devolve success:true para fixtures válidos", () => {
    expect(SiteVariablesSchema.safeParse(validSiteVariablesFixture).success).toBe(true);
    expect(SiteCopySchema.safeParse(validSiteCopyFixture).success).toBe(true);
  });
});

// ===========================================================================
// AC2 — Validação por campo (matriz spec-driven §4)
// ===========================================================================

describe("AC2 — Globais: business_name", () => {
  it("aceita string com 1–80 caracteres", () => {
    const vars = cloneVars();
    vars.business_name = "A";
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
    vars.business_name = "x".repeat(80);
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("rejeita string vazia (min 1)", () => {
    const vars = cloneVars();
    vars.business_name = "";
    expectFailureAtPath(SiteVariablesSchema, vars, "business_name");
  });

  it("rejeita string com mais de 80 caracteres", () => {
    const vars = cloneVars();
    vars.business_name = "x".repeat(81);
    expectFailureAtPath(SiteVariablesSchema, vars, "business_name");
  });
});

describe("AC2 — Globais: business_slug", () => {
  it("aceita slug com lowercase, dígitos e hífen", () => {
    const vars = cloneVars();
    vars.business_slug = "auto-star-2026";
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("rejeita uppercase", () => {
    const vars = cloneVars();
    vars.business_slug = "AutoStar";
    expectFailureAtPath(SiteVariablesSchema, vars, "business_slug");
  });

  it("rejeita espaço", () => {
    const vars = cloneVars();
    vars.business_slug = "auto star";
    expectFailureAtPath(SiteVariablesSchema, vars, "business_slug");
  });

  it("rejeita underscore", () => {
    const vars = cloneVars();
    vars.business_slug = "auto_star";
    expectFailureAtPath(SiteVariablesSchema, vars, "business_slug");
  });
});

describe("AC2 — Globais: slogan", () => {
  it("aceita string com 10–120 caracteres", () => {
    const vars = cloneVars();
    vars.slogan = "x".repeat(10);
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
    vars.slogan = "x".repeat(120);
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("rejeita string com 9 caracteres (abaixo do min 10)", () => {
    const vars = cloneVars();
    vars.slogan = "x".repeat(9);
    expectFailureAtPath(SiteVariablesSchema, vars, "slogan");
  });

  it("rejeita string com 121 caracteres (acima do max 120)", () => {
    const vars = cloneVars();
    vars.slogan = "x".repeat(121);
    expectFailureAtPath(SiteVariablesSchema, vars, "slogan");
  });
});

describe("AC2 — Globais: primary_color", () => {
  it("aceita hex #rrggbb lowercase", () => {
    const vars = cloneVars();
    vars.primary_color = "#0c5fff";
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("aceita hex #RRGGBB uppercase (regex case-insensitive)", () => {
    const vars = cloneVars();
    vars.primary_color = "#0C5FFF";
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("rejeita hex curto #abc", () => {
    const vars = cloneVars();
    vars.primary_color = "#abc";
    expectFailureAtPath(SiteVariablesSchema, vars, "primary_color");
  });

  it("rejeita string sem #", () => {
    const vars = cloneVars();
    vars.primary_color = "0c5fff";
    expectFailureAtPath(SiteVariablesSchema, vars, "primary_color");
  });

  it("rejeita caracteres inválidos no hex", () => {
    const vars = cloneVars();
    vars.primary_color = "#zzzzzz";
    expectFailureAtPath(SiteVariablesSchema, vars, "primary_color");
  });
});

describe("AC2 — Globais: text_on_primary", () => {
  it("aceita #FFFFFF", () => {
    const vars = cloneVars();
    vars.text_on_primary = "#FFFFFF";
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("aceita #0C0C0C", () => {
    const vars = cloneVars();
    vars.text_on_primary = "#0C0C0C";
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("rejeita outros hex válidos (#000000)", () => {
    const vars = cloneVars();
    (vars as unknown as { text_on_primary: string }).text_on_primary =
      "#000000";
    expectFailureAtPath(SiteVariablesSchema, vars, "text_on_primary");
  });

  it("rejeita lowercase #ffffff", () => {
    const vars = cloneVars();
    (vars as unknown as { text_on_primary: string }).text_on_primary =
      "#ffffff";
    expectFailureAtPath(SiteVariablesSchema, vars, "text_on_primary");
  });
});

describe("AC2 — Globais: logo_url", () => {
  it("aceita URL https válida", () => {
    const vars = cloneVars();
    vars.logo_url = "https://cdn.example.com/logo.png";
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("rejeita string sem protocolo", () => {
    const vars = cloneVars();
    vars.logo_url = "cdn.example.com/logo.png";
    expectFailureAtPath(SiteVariablesSchema, vars, "logo_url");
  });

  it("rejeita string vazia", () => {
    const vars = cloneVars();
    vars.logo_url = "";
    expectFailureAtPath(SiteVariablesSchema, vars, "logo_url");
  });
});

describe("AC2 — Globais: whatsapp", () => {
  it("aceita 10 dígitos", () => {
    const vars = cloneVars();
    vars.whatsapp = "1199990000";
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("aceita 13 dígitos (DDI+DDD+9+8 dígitos)", () => {
    const vars = cloneVars();
    vars.whatsapp = "5511999990000";
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("rejeita formato com + (ex.: +5511999990000)", () => {
    const vars = cloneVars();
    vars.whatsapp = "+5511999990000";
    expectFailureAtPath(SiteVariablesSchema, vars, "whatsapp");
  });

  it("rejeita espaços/parênteses", () => {
    const vars = cloneVars();
    vars.whatsapp = "(11) 99999-0000";
    expectFailureAtPath(SiteVariablesSchema, vars, "whatsapp");
  });

  it("rejeita 9 dígitos (abaixo do min)", () => {
    const vars = cloneVars();
    vars.whatsapp = "199990000";
    expectFailureAtPath(SiteVariablesSchema, vars, "whatsapp");
  });

  it("rejeita 14 dígitos (acima do max)", () => {
    const vars = cloneVars();
    vars.whatsapp = "55119999900000";
    expectFailureAtPath(SiteVariablesSchema, vars, "whatsapp");
  });
});

describe("AC2 — Globais: email (nullable)", () => {
  it("aceita null", () => {
    const vars = cloneVars();
    vars.email = null;
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("aceita email válido", () => {
    const vars = cloneVars();
    vars.email = "contato@autostar.com.br";
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("rejeita string vazia", () => {
    const vars = cloneVars();
    vars.email = "";
    expectFailureAtPath(SiteVariablesSchema, vars, "email");
  });

  it("rejeita string sem @", () => {
    const vars = cloneVars();
    vars.email = "naoeumemail";
    expectFailureAtPath(SiteVariablesSchema, vars, "email");
  });
});

describe("AC2 — Globais: nullable URLs e strings de contato", () => {
  it.each([
    "instagram_url",
    "facebook_url",
    "youtube_url",
  ] as const)("%s aceita null", (field) => {
    const vars = cloneVars();
    vars[field] = null;
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it.each([
    ["instagram_url", "https://instagram.com/x"],
    ["facebook_url", "https://facebook.com/x"],
    ["youtube_url", "https://youtube.com/@x"],
  ] as const)("%s aceita URL válida", (field, value) => {
    const vars = cloneVars();
    vars[field] = value;
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it.each([
    "instagram_url",
    "facebook_url",
    "youtube_url",
  ] as const)("%s rejeita string sem protocolo", (field) => {
    const vars = cloneVars();
    vars[field] = "instagram.com/x";
    expectFailureAtPath(SiteVariablesSchema, vars, field);
  });

  it("address_line aceita null e string", () => {
    const vars = cloneVars();
    vars.address_line = null;
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
    vars.address_line = "Rua X, 123";
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("hours aceita null e string", () => {
    const vars = cloneVars();
    vars.hours = null;
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
    vars.hours = "Seg-Sex 09h-18h";
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });
});

describe("AC2 — Home: hero_image_url", () => {
  it("aceita URL válida", () => {
    const vars = cloneVars();
    vars.hero_image_url = "https://cdn.example.com/hero.jpg";
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("rejeita string sem protocolo", () => {
    const vars = cloneVars();
    vars.hero_image_url = "cdn.example.com/hero.jpg";
    expectFailureAtPath(SiteVariablesSchema, vars, "hero_image_url");
  });
});

describe("AC2 — Home: home_categories", () => {
  it("aceita array com exatamente 3 itens", () => {
    expect(
      SiteVariablesSchema.safeParse(validSiteVariablesFixture).success,
    ).toBe(true);
  });

  it("rejeita array com 2 itens", () => {
    const vars = cloneVars();
    vars.home_categories = vars.home_categories.slice(0, 2) as typeof vars.home_categories;
    expectFailureAtPath(SiteVariablesSchema, vars, "home_categories");
  });

  it("rejeita array com 4 itens", () => {
    const vars = cloneVars();
    vars.home_categories = [
      ...vars.home_categories,
      {
        label: "Extra",
        image_url: "https://cdn.example.com/cat/extra.jpg",
      },
    ] as typeof vars.home_categories;
    expectFailureAtPath(SiteVariablesSchema, vars, "home_categories");
  });

  it("rejeita array vazio", () => {
    const vars = cloneVars();
    vars.home_categories = [] as unknown as typeof vars.home_categories;
    expectFailureAtPath(SiteVariablesSchema, vars, "home_categories");
  });

  it("rejeita label com 1 caractere (min 2)", () => {
    const vars = cloneVars();
    vars.home_categories[0]!.label = "A";
    expectFailureAtPath(SiteVariablesSchema, vars, "home_categories");
  });

  it("rejeita label com 31 caracteres (max 30)", () => {
    const vars = cloneVars();
    vars.home_categories[0]!.label = "x".repeat(31);
    expectFailureAtPath(SiteVariablesSchema, vars, "home_categories");
  });

  it("rejeita image_url sem protocolo", () => {
    const vars = cloneVars();
    vars.home_categories[0]!.image_url = "cdn.example.com/x.jpg";
    expectFailureAtPath(SiteVariablesSchema, vars, "home_categories");
  });
});

describe("AC2 — Home: emphasis", () => {
  it("aceita description com 50–400 caracteres", () => {
    const vars = cloneVars();
    vars.emphasis.description = "x".repeat(50);
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
    vars.emphasis.description = "x".repeat(400);
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("rejeita description com 49 caracteres", () => {
    const vars = cloneVars();
    vars.emphasis.description = "x".repeat(49);
    expectFailureAtPath(SiteVariablesSchema, vars, "emphasis");
  });

  it("rejeita description com 401 caracteres", () => {
    const vars = cloneVars();
    vars.emphasis.description = "x".repeat(401);
    expectFailureAtPath(SiteVariablesSchema, vars, "emphasis");
  });

  it("rejeita image_url sem protocolo", () => {
    const vars = cloneVars();
    vars.emphasis.image_url = "no-protocol.jpg";
    expectFailureAtPath(SiteVariablesSchema, vars, "emphasis");
  });
});

describe("AC2 — Home: recent_sales", () => {
  it("rejeita array com 2 itens", () => {
    const vars = cloneVars();
    vars.recent_sales = vars.recent_sales.slice(0, 2) as typeof vars.recent_sales;
    expectFailureAtPath(SiteVariablesSchema, vars, "recent_sales");
  });

  it("rejeita array com 4 itens", () => {
    const vars = cloneVars();
    vars.recent_sales = [
      ...vars.recent_sales,
      {
        car_name: "Extra",
        image_url: "https://cdn.example.com/recent/extra.jpg",
      },
    ] as typeof vars.recent_sales;
    expectFailureAtPath(SiteVariablesSchema, vars, "recent_sales");
  });

  it("rejeita image_url inválida", () => {
    const vars = cloneVars();
    vars.recent_sales[0]!.image_url = "no-protocol.jpg";
    expectFailureAtPath(SiteVariablesSchema, vars, "recent_sales");
  });
});

describe("AC2 — Sobre: about_text", () => {
  it("aceita 200–1500 caracteres", () => {
    const vars = cloneVars();
    vars.about_text = "x".repeat(200);
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
    vars.about_text = "x".repeat(1500);
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("rejeita 199 caracteres", () => {
    const vars = cloneVars();
    vars.about_text = "x".repeat(199);
    expectFailureAtPath(SiteVariablesSchema, vars, "about_text");
  });

  it("rejeita 1501 caracteres", () => {
    const vars = cloneVars();
    vars.about_text = "x".repeat(1501);
    expectFailureAtPath(SiteVariablesSchema, vars, "about_text");
  });
});

describe("AC2 — Sobre: about_image_url", () => {
  it("rejeita string sem protocolo", () => {
    const vars = cloneVars();
    vars.about_image_url = "no-protocol.jpg";
    expectFailureAtPath(SiteVariablesSchema, vars, "about_image_url");
  });
});

describe("AC2 — Sobre: mission e vision", () => {
  it.each(["mission", "vision"] as const)("%s aceita 40–200 caracteres", (field) => {
    const vars = cloneVars();
    vars[field] = "x".repeat(40);
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
    vars[field] = "x".repeat(200);
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it.each(["mission", "vision"] as const)("%s rejeita 39 caracteres", (field) => {
    const vars = cloneVars();
    vars[field] = "x".repeat(39);
    expectFailureAtPath(SiteVariablesSchema, vars, field);
  });

  it.each(["mission", "vision"] as const)("%s rejeita 201 caracteres", (field) => {
    const vars = cloneVars();
    vars[field] = "x".repeat(201);
    expectFailureAtPath(SiteVariablesSchema, vars, field);
  });
});

describe("AC2 — Sobre: values", () => {
  it("aceita array com 4–8 strings de 8–80 caracteres", () => {
    const vars = cloneVars();
    vars.values = Array.from({ length: 4 }, () => "x".repeat(8));
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
    vars.values = Array.from({ length: 8 }, () => "x".repeat(80));
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("rejeita array com 3 itens (min 4)", () => {
    const vars = cloneVars();
    vars.values = vars.values.slice(0, 3);
    expectFailureAtPath(SiteVariablesSchema, vars, "values");
  });

  it("rejeita array com 9 itens (max 8)", () => {
    const vars = cloneVars();
    vars.values = Array.from({ length: 9 }, () => "x".repeat(8));
    expectFailureAtPath(SiteVariablesSchema, vars, "values");
  });

  it("rejeita string com 7 caracteres", () => {
    const vars = cloneVars();
    vars.values[0] = "x".repeat(7);
    expectFailureAtPath(SiteVariablesSchema, vars, "values");
  });

  it("rejeita string com 81 caracteres", () => {
    const vars = cloneVars();
    vars.values[0] = "x".repeat(81);
    expectFailureAtPath(SiteVariablesSchema, vars, "values");
  });
});

describe("AC2 — Contato: contact_hero_image_url", () => {
  it("rejeita string sem protocolo", () => {
    const vars = cloneVars();
    vars.contact_hero_image_url = "no-protocol.jpg";
    expectFailureAtPath(SiteVariablesSchema, vars, "contact_hero_image_url");
  });
});

describe("AC2 — Estoque: cars (array length)", () => {
  it("aceita 4 carros (min)", () => {
    const vars = cloneVars();
    vars.cars = vars.cars.slice(0, 4) as typeof vars.cars;
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("aceita mais de 12 carros para suportar estoque paginado", () => {
    const vars = cloneVars();
    const extras: SiteCar[] = Array.from({ length: 9 }, (_, i) => {
      const copy = JSON.parse(JSON.stringify(vars.cars[0])) as SiteCar;
      copy.slug = `extra-${i}`;
      return copy;
    });
    vars.cars = [...vars.cars, ...extras];
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("rejeita 3 carros (min 4)", () => {
    const vars = cloneVars();
    vars.cars = vars.cars.slice(0, 3) as typeof vars.cars;
    expectFailureAtPath(SiteVariablesSchema, vars, "cars");
  });

  it("rejeita carros acima do teto público", () => {
    const vars = cloneVars();
    const extras: SiteCar[] = Array.from(
      { length: SITE_STOCK_MAX_CARS + 1 },
      (_, i) => {
        const copy = JSON.parse(JSON.stringify(vars.cars[0])) as SiteCar;
        copy.slug = `extra-${i}`;
        return copy;
      },
    );
    vars.cars = extras;
    expectFailureAtPath(SiteVariablesSchema, vars, "cars");
  });

  it("rejeita array vazio", () => {
    const vars = cloneVars();
    vars.cars = [] as unknown as typeof vars.cars;
    expectFailureAtPath(SiteVariablesSchema, vars, "cars");
  });
});

// ---------------------------------------------------------------------------
// AC2 — SiteCar (carro individual)
// ---------------------------------------------------------------------------

describe("AC2 — SiteCar: slug", () => {
  it("aceita slug com lowercase, dígitos e hífen", () => {
    const car = cloneCar();
    car.slug = "honda-civic-touring-2023";
    expect(SiteCarSchema.safeParse(car).success).toBe(true);
  });

  it("rejeita uppercase", () => {
    const car = cloneCar();
    car.slug = "Honda-Civic";
    expectFailureAtPath(SiteCarSchema, car, "slug");
  });

  it("rejeita underscore", () => {
    const car = cloneCar();
    car.slug = "honda_civic";
    expectFailureAtPath(SiteCarSchema, car, "slug");
  });
});

describe("AC2 — SiteCar: year", () => {
  const currentYear = new Date().getFullYear();

  it("aceita 1990", () => {
    const car = cloneCar();
    car.year = 1990;
    expect(SiteCarSchema.safeParse(car).success).toBe(true);
  });

  it(`aceita ano corrente + 1 (${currentYear + 1})`, () => {
    const car = cloneCar();
    car.year = currentYear + 1;
    expect(SiteCarSchema.safeParse(car).success).toBe(true);
  });

  it("rejeita 1989 (abaixo do min)", () => {
    const car = cloneCar();
    car.year = 1989;
    expectFailureAtPath(SiteCarSchema, car, "year");
  });

  it(`rejeita ano corrente + 2 (${currentYear + 2})`, () => {
    const car = cloneCar();
    car.year = currentYear + 2;
    expectFailureAtPath(SiteCarSchema, car, "year");
  });

  it("rejeita float (não-inteiro)", () => {
    const car = cloneCar();
    car.year = 2023.5;
    expectFailureAtPath(SiteCarSchema, car, "year");
  });
});

describe("AC2 — SiteCar: km", () => {
  it("aceita 0 (min inclusivo)", () => {
    const car = cloneCar();
    car.km = 0;
    expect(SiteCarSchema.safeParse(car).success).toBe(true);
  });

  it("aceita valor alto (sem max superior)", () => {
    const car = cloneCar();
    car.km = 999_999;
    expect(SiteCarSchema.safeParse(car).success).toBe(true);
  });

  it("rejeita negativo", () => {
    const car = cloneCar();
    car.km = -1;
    expectFailureAtPath(SiteCarSchema, car, "km");
  });

  it("rejeita float", () => {
    const car = cloneCar();
    car.km = 1500.5;
    expectFailureAtPath(SiteCarSchema, car, "km");
  });
});

describe("AC2 — SiteCar: price (positive nullable)", () => {
  it("aceita null", () => {
    const car = cloneCar();
    car.price = null;
    expect(SiteCarSchema.safeParse(car).success).toBe(true);
  });

  it("aceita número positivo", () => {
    const car = cloneCar();
    car.price = 1;
    expect(SiteCarSchema.safeParse(car).success).toBe(true);
  });

  it("rejeita 0 (não-positivo)", () => {
    const car = cloneCar();
    car.price = 0;
    expectFailureAtPath(SiteCarSchema, car, "price");
  });

  it("rejeita negativo", () => {
    const car = cloneCar();
    car.price = -100;
    expectFailureAtPath(SiteCarSchema, car, "price");
  });
});

describe("AC2 — SiteCar: transmission (enum)", () => {
  it.each(["Manual", "Automático", "CVT", "Outros"] as const)(
    "aceita %s",
    (value) => {
      const car = cloneCar();
      car.transmission = value;
      expect(SiteCarSchema.safeParse(car).success).toBe(true);
    },
  );

  it("rejeita 'Automatico' sem acento", () => {
    const car = cloneCar();
    (car as unknown as { transmission: string }).transmission = "Automatico";
    expectFailureAtPath(SiteCarSchema, car, "transmission");
  });

  it("rejeita string vazia", () => {
    const car = cloneCar();
    (car as unknown as { transmission: string }).transmission = "";
    expectFailureAtPath(SiteCarSchema, car, "transmission");
  });
});

describe("AC2 — SiteCar: fuel (enum)", () => {
  it.each([
    "Gasolina",
    "Etanol",
    "Flex",
    "Diesel",
    "Híbrido",
    "Elétrico",
  ] as const)("aceita %s", (value) => {
    const car = cloneCar();
    car.fuel = value;
    expect(SiteCarSchema.safeParse(car).success).toBe(true);
  });

  it("rejeita 'Hibrido' sem acento", () => {
    const car = cloneCar();
    (car as unknown as { fuel: string }).fuel = "Hibrido";
    expectFailureAtPath(SiteCarSchema, car, "fuel");
  });

  it("rejeita 'GNV'", () => {
    const car = cloneCar();
    (car as unknown as { fuel: string }).fuel = "GNV";
    expectFailureAtPath(SiteCarSchema, car, "fuel");
  });
});

describe("AC2 — SiteCar: description", () => {
  it("aceita 80–800 caracteres", () => {
    const car = cloneCar();
    car.description = "x".repeat(80);
    expect(SiteCarSchema.safeParse(car).success).toBe(true);
    car.description = "x".repeat(800);
    expect(SiteCarSchema.safeParse(car).success).toBe(true);
  });

  it("rejeita 79 caracteres", () => {
    const car = cloneCar();
    car.description = "x".repeat(79);
    expectFailureAtPath(SiteCarSchema, car, "description");
  });

  it("rejeita 801 caracteres", () => {
    const car = cloneCar();
    car.description = "x".repeat(801);
    expectFailureAtPath(SiteCarSchema, car, "description");
  });
});

describe("AC2 — SiteCar: thumbnail_url e gallery_urls", () => {
  it("rejeita thumbnail_url sem protocolo", () => {
    const car = cloneCar();
    car.thumbnail_url = "cdn.example.com/x.jpg";
    expectFailureAtPath(SiteCarSchema, car, "thumbnail_url");
  });

  it("aceita 3 imagens (min)", () => {
    const car = cloneCar();
    car.gallery_urls = [
      "https://cdn.example.com/1.jpg",
      "https://cdn.example.com/2.jpg",
      "https://cdn.example.com/3.jpg",
    ];
    expect(SiteCarSchema.safeParse(car).success).toBe(true);
  });

  it("aceita 8 imagens (max)", () => {
    const car = cloneCar();
    car.gallery_urls = Array.from(
      { length: 8 },
      (_, i) => `https://cdn.example.com/${i}.jpg`,
    );
    expect(SiteCarSchema.safeParse(car).success).toBe(true);
  });

  it("rejeita 2 imagens (abaixo do min 3)", () => {
    const car = cloneCar();
    car.gallery_urls = [
      "https://cdn.example.com/1.jpg",
      "https://cdn.example.com/2.jpg",
    ];
    expectFailureAtPath(SiteCarSchema, car, "gallery_urls");
  });

  it("rejeita 9 imagens (acima do max 8)", () => {
    const car = cloneCar();
    car.gallery_urls = Array.from(
      { length: 9 },
      (_, i) => `https://cdn.example.com/${i}.jpg`,
    );
    expectFailureAtPath(SiteCarSchema, car, "gallery_urls");
  });

  it("rejeita item da gallery sem protocolo", () => {
    const car = cloneCar();
    car.gallery_urls = [
      "no-protocol.jpg",
      "https://cdn.example.com/2.jpg",
      "https://cdn.example.com/3.jpg",
    ];
    expectFailureAtPath(SiteCarSchema, car, "gallery_urls");
  });
});

describe("AC2 — SiteCar: datasheet (tuple [string, string])", () => {
  it("aceita array de tuplas string/string", () => {
    const car = cloneCar();
    car.datasheet = [
      ["Motor", "2.0"],
      ["Câmbio", "Auto"],
    ];
    expect(SiteCarSchema.safeParse(car).success).toBe(true);
  });

  it("aceita array vazio (sem min)", () => {
    const car = cloneCar();
    car.datasheet = [];
    expect(SiteCarSchema.safeParse(car).success).toBe(true);
  });

  it("rejeita tupla [string, number]", () => {
    const car = cloneCar();
    (car as unknown as { datasheet: unknown[] }).datasheet = [["Portas", 4]];
    expectFailureAtPath(SiteCarSchema, car, "datasheet");
  });

  it("rejeita tupla unária [string]", () => {
    const car = cloneCar();
    (car as unknown as { datasheet: unknown[] }).datasheet = [["Solo"]];
    expectFailureAtPath(SiteCarSchema, car, "datasheet");
  });
});

describe("AC2 — SiteCar: featured (boolean)", () => {
  it.each([true, false])("aceita %s", (value) => {
    const car = cloneCar();
    car.featured = value;
    expect(SiteCarSchema.safeParse(car).success).toBe(true);
  });

  it("rejeita string 'true'", () => {
    const car = cloneCar();
    (car as unknown as { featured: string }).featured = "true";
    expectFailureAtPath(SiteCarSchema, car, "featured");
  });
});

describe("AC2 — Metadata: generated_by (literal)", () => {
  it("aceita literal 'claude-sonnet-4-6'", () => {
    expect(SiteVariablesSchema.safeParse(validSiteVariablesFixture).success).toBe(true);
  });

  it("rejeita outro modelo (ex.: 'claude-haiku-4-6')", () => {
    const vars = cloneVars();
    (vars as unknown as { generated_by: string }).generated_by =
      "claude-haiku-4-6";
    expectFailureAtPath(SiteVariablesSchema, vars, "generated_by");
  });

  it("rejeita string vazia", () => {
    const vars = cloneVars();
    (vars as unknown as { generated_by: string }).generated_by = "";
    expectFailureAtPath(SiteVariablesSchema, vars, "generated_by");
  });
});

describe("AC2 — Metadata: generation_version (string)", () => {
  it("aceita qualquer string (ex.: 'v1.0.0')", () => {
    const vars = cloneVars();
    vars.generation_version = "v1.0.0";
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("aceita string arbitrária (sem constraints)", () => {
    const vars = cloneVars();
    vars.generation_version = "qualquer-coisa-2026";
    expect(SiteVariablesSchema.safeParse(vars).success).toBe(true);
  });

  it("rejeita number", () => {
    const vars = cloneVars();
    (vars as unknown as { generation_version: number }).generation_version = 1;
    expectFailureAtPath(SiteVariablesSchema, vars, "generation_version");
  });
});

// ===========================================================================
// AC3 — SiteCopySchema: subset textual emitido pela IA
// ===========================================================================

describe("AC3 — SiteCopySchema é subset textual de SiteVariables", () => {
  // Lista canônica derivada de §6: campos que a IA emite.
  const aiTopLevelFields = [
    "slogan",
    "home_categories",
    "emphasis",
    "about_text",
    "mission",
    "vision",
    "values",
    "cars",
  ];

  it("inclui exatamente os campos textuais que a IA emite", () => {
    expect(Object.keys(SiteCopySchema.shape).sort()).toEqual(
      [...aiTopLevelFields].sort(),
    );
  });

  it("emphasis inclui apenas {title, description} (sem car_name, image_url)", () => {
    expect(Object.keys(SiteCopySchema.shape.emphasis.shape).sort()).toEqual(
      ["description", "title"],
    );
  });

  it("home_categories[].label só (sem image_url, que vem do brand-pipeline)", () => {
    const homeArr = SiteCopySchema.shape.home_categories;
    // estrutura: ZodArray<ZodObject<{ label: ... }>>; testamos via parse
    const valid = cloneCopy();
    expect(SiteCopySchema.safeParse(valid).success).toBe(true);
    // adicionar image_url não deve fazer falhar (zod strip por padrão), mas
    // tampouco aparece no shape:
    expect(Object.keys(homeArr.element.shape)).toEqual(["label"]);
  });

  it("cars[i] inclui apenas {description, datasheet, featured}", () => {
    expect(
      Object.keys(SiteCopySchema.shape.cars.element.shape).sort(),
    ).toEqual(["datasheet", "description", "featured"]);
    // SiteCopyCar exposto separadamente bate com cars[i]:
    expect(Object.keys(SiteCopyCarSchema.shape).sort()).toEqual([
      "datasheet",
      "description",
      "featured",
    ]);
  });

  it("NÃO inclui brand assets, URLs ou lead metadata", () => {
    const excluded = [
      "business_name",
      "business_slug",
      "primary_color",
      "text_on_primary",
      "logo_url",
      "whatsapp",
      "phone_display",
      "email",
      "instagram_url",
      "facebook_url",
      "youtube_url",
      "address_line",
      "hours",
      "hero_image_url",
      "recent_sales",
      "about_image_url",
      "contact_hero_image_url",
      "generated_by",
      "generation_version",
    ];
    const keys = Object.keys(SiteCopySchema.shape);
    for (const field of excluded) {
      expect(keys).not.toContain(field);
    }
  });

  it("aplica mesmas constraints de SiteVariables (slogan 10..120)", () => {
    const copy = cloneCopy();
    copy.slogan = "x".repeat(9);
    expectFailureAtPath(SiteCopySchema, copy, "slogan");
    copy.slogan = "x".repeat(121);
    expectFailureAtPath(SiteCopySchema, copy, "slogan");
  });

  it("mantém SiteCopy limitado ao lote inicial de carros (4..6)", () => {
    const copy = cloneCopy();
    copy.cars = copy.cars.slice(0, 3) as typeof copy.cars;
    expectFailureAtPath(SiteCopySchema, copy, "cars");
  });

  it("aplica mesmas constraints de car description (80..800)", () => {
    const copy = cloneCopy();
    copy.cars[0]!.description = "x".repeat(79);
    expectFailureAtPath(SiteCopySchema, copy, "cars");
  });

  it("home_categories.length(3) também aplica em SiteCopySchema", () => {
    const copy = cloneCopy();
    copy.home_categories = copy.home_categories.slice(
      0,
      2,
    ) as typeof copy.home_categories;
    expectFailureAtPath(SiteCopySchema, copy, "home_categories");
  });
});

// ===========================================================================
// AC4 — Failure modes (campos ausentes + safeParse retorna issues)
// ===========================================================================

describe("AC4 — campos obrigatórios ausentes lançam ZodError no path", () => {
  const requiredTopLevel: ReadonlyArray<keyof SiteVariables> = [
    "business_name",
    "business_slug",
    "slogan",
    "primary_color",
    "text_on_primary",
    "logo_url",
    "whatsapp",
    "phone_display",
    "hero_image_url",
    "home_categories",
    "emphasis",
    "recent_sales",
    "about_text",
    "about_image_url",
    "mission",
    "vision",
    "values",
    "contact_hero_image_url",
    "cars",
    "generated_by",
    "generation_version",
  ];

  it.each(requiredTopLevel)("falha quando %s está ausente", (field) => {
    const vars = cloneVars() as Partial<SiteVariables>;
    delete vars[field];
    const result = SiteVariablesSchema.safeParse(vars);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.some((issue) => issue.path.includes(field)),
    ).toBe(true);
  });

  it("safeParse de payload completamente inválido retorna issues.length >= 1", () => {
    const result = SiteVariablesSchema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.length).toBeGreaterThanOrEqual(1);
  });

  it("safeParse com string ao invés de objeto retorna issues.length >= 1", () => {
    const result = SiteVariablesSchema.safeParse("not-an-object");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.length).toBeGreaterThanOrEqual(1);
  });

  it("parse() (não-safe) lança ZodError para payload inválido", () => {
    expect(() => SiteVariablesSchema.parse({})).toThrowError();
  });
});

describe("AC4 — SiteCar: campos obrigatórios ausentes", () => {
  const requiredCarFields: ReadonlyArray<keyof SiteCar> = [
    "slug",
    "brand",
    "model",
    "year",
    "km",
    "transmission",
    "fuel",
    "color",
    "description",
    "thumbnail_url",
    "gallery_urls",
    "datasheet",
    "featured",
  ];

  it.each(requiredCarFields)(
    "SiteCar falha quando %s está ausente",
    (field) => {
      const car = cloneCar() as Partial<SiteCar>;
      delete car[field];
      const result = SiteCarSchema.safeParse(car);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(
        result.error.issues.some((issue) => issue.path.includes(field)),
      ).toBe(true);
    },
  );
});

describe("AC4 — SiteCopySchema: campos ausentes", () => {
  const requiredCopyFields: ReadonlyArray<keyof SiteCopy> = [
    "slogan",
    "home_categories",
    "emphasis",
    "about_text",
    "mission",
    "vision",
    "values",
    "cars",
  ];

  it.each(requiredCopyFields)(
    "SiteCopySchema falha quando %s está ausente",
    (field) => {
      const copy = cloneCopy() as Partial<SiteCopy>;
      delete copy[field];
      const result = SiteCopySchema.safeParse(copy);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(
        result.error.issues.some((issue) => issue.path.includes(field)),
      ).toBe(true);
    },
  );

  it("SiteCopyCar falha quando description está ausente", () => {
    const car = cloneCopyCar() as Partial<SiteCopyCar>;
    delete car.description;
    expectFailureAtPath(SiteCopyCarSchema, car, "description");
  });
});

// ===========================================================================
// AC5 — Exports
// ===========================================================================

describe("AC5 — exports", () => {
  it("schemas estão exportados (runtime)", () => {
    expect(SiteVariablesSchema).toBeDefined();
    expect(SiteCarSchema).toBeDefined();
    expect(SiteCopySchema).toBeDefined();
    expect(SiteCopyCarSchema).toBeDefined();
  });

  it("tipos TS via z.infer<> são consumíveis (compile-time)", () => {
    // Se este arquivo compila com strict + noUncheckedIndexedAccess (gate
    // do CLAUDE.md), os tipos `SiteVariables`, `SiteCar`, `SiteCopy`,
    // `SiteCopyCar` estão disponíveis pra anotação. Construir um valor
    // tipado garante a inferência.
    const vars: SiteVariables = validSiteVariablesFixture;
    const car: SiteCar = validSiteVariablesFixture.cars[0]!;
    const copy: SiteCopy = validSiteCopyFixture;
    const copyCar: SiteCopyCar = validSiteCopyFixture.cars[0]!;
    expect(vars).toBeDefined();
    expect(car).toBeDefined();
    expect(copy).toBeDefined();
    expect(copyCar).toBeDefined();
  });
});
