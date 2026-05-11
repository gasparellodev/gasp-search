/**
 * Schema.org JSON-LD builders — unit tests (issue #211 / Sprint 1 / #S1).
 *
 * Cobre cada um dos 5 builders + helper `buildSitewideGraph` + decisões PO:
 *   - `address === null` → omitir key inteira (não emite `PostalAddress` vazio).
 *   - `cars.length === 0` → omitir `priceRange`.
 *   - `social.*` ausente → omitir `sameAs`.
 *   - `Vehicle.image: photos[]` com fallback `thumbnail_url` quando vazio.
 *   - `@id` linking absoluto (`baseUrl/sites/<slug>#fragment`).
 *   - `priceCurrency: 'BRL'` + `itemCondition: UsedCondition` (URL completa).
 *
 * Foco: builders são puros (no DB / fetch / env outside `NEXT_PUBLIC_APP_URL`).
 * Cada test parte de fixtures v2 reusáveis com overrides.
 */

import { describe, expect, it } from "vitest";

import {
  buildAutoDealerSchema,
  buildBreadcrumbSchema,
  buildLocalBusinessSchema,
  buildOrganizationSchema,
  buildSitewideGraph,
  buildVehicleSchema,
  buildWebSiteSchema,
} from "@/lib/sites/schema";
import { fixtureSiteVariablesV2 } from "@/tests/fixtures/site-variables/site-variables-v2";
import type { SiteVariablesV2 } from "@/types/lead-site";

const BASE_URL = "http://localhost:3000";

/**
 * `schema-dts` tipa cada propriedade Schema.org como union exaustivo —
 * inviável pra asserts em test (`schema['@type']` vira `never` em
 * narrowing). Coercemos pra `Record<string, unknown>` no acesso pra
 * permitir testes runtime-puros, mas mantemos a tipagem rica no
 * builder.
 */
function asRecord(schema: unknown): Record<string, unknown> {
  return schema as Record<string, unknown>;
}

function makeV2(overrides: Partial<SiteVariablesV2> = {}): SiteVariablesV2 {
  return { ...fixtureSiteVariablesV2, ...overrides };
}

describe("buildAutoDealerSchema()", () => {
  it("emite @context, @type AutoDealer e @id absoluto com fragment #dealer", () => {
    const schema = buildAutoDealerSchema(makeV2());
    expect(asRecord(schema)["@context"]).toBe("https://schema.org");
    expect(asRecord(schema)["@type"]).toBe("AutoDealer");
    expect(asRecord(schema)["@id"]).toBe(
      `${BASE_URL}/sites/auto-fit-multimarcas#dealer`,
    );
  });

  it("inclui name, url, image (logo)", () => {
    const schema = buildAutoDealerSchema(makeV2());
    expect(asRecord(schema).name).toBe("Auto Fit Multimarcas");
    expect(asRecord(schema).url).toBe(`${BASE_URL}/sites/auto-fit-multimarcas`);
    expect(asRecord(schema).image).toBe("https://example.com/logo-auto-fit.png");
  });

  it("emite priceRange quando cars.length > 0 (min/max preço)", () => {
    const schema = buildAutoDealerSchema(makeV2());
    // Cars do fixture v2: prices 489900, 1689000, 389900, 269900
    expect(asRecord(schema).priceRange).toBe("R$ 269.900 - R$ 1.689.000");
  });

  it("OMITE priceRange quando cars=[] (não emite key)", () => {
    const v2 = makeV2({ cars: [] as unknown as SiteVariablesV2["cars"] });
    const schema = buildAutoDealerSchema(v2);
    expect("priceRange" in schema).toBe(false);
  });

  it("emite address PostalAddress quando address não-null", () => {
    const schema = buildAutoDealerSchema(makeV2());
    expect(asRecord(schema).address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "Av. Paulista, 1000",
      addressLocality: "São Paulo",
      addressRegion: "SP",
      postalCode: "01310-100",
      addressCountry: "BR",
    });
  });

  it("OMITE address quando variables.address === null (não emite PostalAddress vazio)", () => {
    const schema = buildAutoDealerSchema(makeV2({ address: null }));
    expect("address" in schema).toBe(false);
  });

  it("emite telephone com WhatsApp E.164 quando whatsapp presente", () => {
    const schema = buildAutoDealerSchema(makeV2());
    expect(asRecord(schema).telephone).toBe("+5511987654321");
  });

  it("emite parentOrganization linkando o Organization @id", () => {
    const schema = buildAutoDealerSchema(makeV2());
    expect(asRecord(schema).parentOrganization).toEqual({
      "@id": `${BASE_URL}/sites/auto-fit-multimarcas#org`,
    });
  });
});

describe("buildOrganizationSchema()", () => {
  it("@type Organization + @id #org + name + url + logo", () => {
    const schema = buildOrganizationSchema(makeV2());
    expect(asRecord(schema)["@type"]).toBe("Organization");
    expect(asRecord(schema)["@id"]).toBe(`${BASE_URL}/sites/auto-fit-multimarcas#org`);
    expect(asRecord(schema).name).toBe("Auto Fit Multimarcas");
    expect(asRecord(schema).logo).toBe("https://example.com/logo-auto-fit.png");
  });

  it("emite sameAs derivado de social URLs (apenas as não-null)", () => {
    const schema = buildOrganizationSchema(makeV2());
    // Fixture v2: instagram_url present, facebook_url e youtube_url null
    expect(asRecord(schema).sameAs).toEqual([
      "https://instagram.com/autofitmultimarcas",
    ]);
  });

  it("OMITE sameAs quando TODAS as social URLs são null (não emite array vazio)", () => {
    const v2 = makeV2({
      instagram_url: null,
      facebook_url: null,
      youtube_url: null,
    });
    const schema = buildOrganizationSchema(v2);
    expect("sameAs" in schema).toBe(false);
  });

  it("inclui todas as 3 social URLs em sameAs quando presentes", () => {
    const v2 = makeV2({
      instagram_url: "https://instagram.com/a",
      facebook_url: "https://facebook.com/b",
      youtube_url: "https://youtube.com/@c",
    });
    const schema = buildOrganizationSchema(v2);
    expect(asRecord(schema).sameAs).toEqual([
      "https://instagram.com/a",
      "https://facebook.com/b",
      "https://youtube.com/@c",
    ]);
  });
});

describe("buildLocalBusinessSchema()", () => {
  it("@type LocalBusiness + @id #localbusiness", () => {
    const schema = buildLocalBusinessSchema(makeV2());
    expect(asRecord(schema)["@type"]).toBe("LocalBusiness");
    expect(asRecord(schema)["@id"]).toBe(
      `${BASE_URL}/sites/auto-fit-multimarcas#localbusiness`,
    );
  });

  it("inclui name + url + telephone", () => {
    const schema = buildLocalBusinessSchema(makeV2());
    expect(asRecord(schema).name).toBe("Auto Fit Multimarcas");
    expect(asRecord(schema).url).toBe(`${BASE_URL}/sites/auto-fit-multimarcas`);
    expect(asRecord(schema).telephone).toBe("+5511987654321");
  });

  it("OMITE address quando null", () => {
    const schema = buildLocalBusinessSchema(makeV2({ address: null }));
    expect("address" in schema).toBe(false);
  });

  it("emite openingHours como string array quando hours presente", () => {
    const schema = buildLocalBusinessSchema(makeV2());
    expect(asRecord(schema).openingHours).toBe("Seg-Sex: 9h-18h | Sáb: 9h-13h");
  });

  it("OMITE openingHours quando hours === null", () => {
    const schema = buildLocalBusinessSchema(makeV2({ hours: null }));
    expect("openingHours" in schema).toBe(false);
  });
});

describe("buildVehicleSchema()", () => {
  it("@type Vehicle + @id absoluto com /estoque/<slug>#vehicle", () => {
    const v2 = makeV2();
    const car = v2.cars[0]!;
    const schema = buildVehicleSchema(car, v2);
    expect(asRecord(schema)["@type"]).toBe("Vehicle");
    expect(asRecord(schema)["@id"]).toBe(
      `${BASE_URL}/sites/auto-fit-multimarcas/estoque/bmw-m2-2023-001#vehicle`,
    );
  });

  it("name = '<brand> <model> <year>' (sem version)", () => {
    const v2 = makeV2();
    const car = v2.cars[0]!;
    const schema = buildVehicleSchema(car, v2);
    expect(asRecord(schema).name).toBe("BMW M2 Coupé 2023");
  });

  it("emite brand como Brand {name}", () => {
    const v2 = makeV2();
    const car = v2.cars[0]!;
    const schema = buildVehicleSchema(car, v2);
    expect(asRecord(schema).brand).toEqual({ "@type": "Brand", name: "BMW" });
  });

  it("vehicleModelDate = year (string)", () => {
    const v2 = makeV2();
    const car = v2.cars[0]!;
    const schema = buildVehicleSchema(car, v2);
    expect(asRecord(schema).vehicleModelDate).toBe("2023");
  });

  it("mileageFromOdometer QuantitativeValue unitCode KMT", () => {
    const v2 = makeV2();
    const car = v2.cars[0]!;
    const schema = buildVehicleSchema(car, v2);
    expect(asRecord(schema).mileageFromOdometer).toEqual({
      "@type": "QuantitativeValue",
      value: 12450,
      unitCode: "KMT",
    });
  });

  it("itemCondition fixed em UsedCondition URL completa", () => {
    const v2 = makeV2();
    const car = v2.cars[0]!;
    const schema = buildVehicleSchema(car, v2);
    expect(asRecord(schema).itemCondition).toBe("https://schema.org/UsedCondition");
  });

  it("offers Offer com price (string) + priceCurrency BRL", () => {
    const v2 = makeV2();
    const car = v2.cars[0]!;
    const schema = buildVehicleSchema(car, v2);
    expect(asRecord(schema).offers).toMatchObject({
      "@type": "Offer",
      price: "489900",
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
    });
  });

  it("offers.seller aponta para AutoDealer @id (cross-reference)", () => {
    const v2 = makeV2();
    const car = v2.cars[0]!;
    const schema = buildVehicleSchema(car, v2);
    const offers = asRecord(schema).offers as Record<string, unknown>;
    expect(offers.seller).toEqual({
      "@id": `${BASE_URL}/sites/auto-fit-multimarcas#dealer`,
    });
  });

  it("OMITE offers quando car.price === null (não emite Offer com price vazio)", () => {
    const v2 = makeV2();
    const carWithoutPrice = { ...v2.cars[0]!, price: null };
    const schema = buildVehicleSchema(carWithoutPrice, v2);
    expect("offers" in schema).toBe(false);
  });

  it("image: array completo de photos[] quando length > 0", () => {
    const v2 = makeV2();
    const car = v2.cars[0]!;
    const schema = buildVehicleSchema(car, v2);
    expect(asRecord(schema).image).toEqual([
      "/assets/stock/m2.png",
      "/assets/stock/m2.png",
      "/assets/stock/m2.png",
    ]);
  });

  it("image fallback: thumbnail_url quando photos undefined (legado v1)", () => {
    const v2 = makeV2();
    const carWithoutPhotos = { ...v2.cars[0]! };
    delete (carWithoutPhotos as { photos?: unknown }).photos;
    const schema = buildVehicleSchema(carWithoutPhotos, v2);
    expect(asRecord(schema).image).toBe("/assets/stock/m2.png");
  });

  it("fuelType: mapeia 'Gasolina' → 'Gasoline' (vocabulário Schema.org)", () => {
    const v2 = makeV2();
    const car = v2.cars[0]!;
    const schema = buildVehicleSchema(car, v2);
    expect(asRecord(schema).fuelType).toBe("Gasoline");
  });

  it("color: copia direto do car", () => {
    const v2 = makeV2();
    const car = v2.cars[0]!;
    const schema = buildVehicleSchema(car, v2);
    expect(asRecord(schema).color).toBe("Cinza");
  });

  it("vehicleTransmission: mapeia 'Automático' → 'Automatic'", () => {
    const v2 = makeV2();
    const car = v2.cars[0]!;
    const schema = buildVehicleSchema(car, v2);
    expect(asRecord(schema).vehicleTransmission).toBe("Automatic");
  });

  it("numberOfDoors quando car.doors definido", () => {
    const v2 = makeV2();
    const car = v2.cars[0]!;
    const schema = buildVehicleSchema(car, v2);
    expect(asRecord(schema).numberOfDoors).toBe(2);
  });

  it("OMITE numberOfDoors quando car.doors undefined", () => {
    const v2 = makeV2();
    const carWithoutDoors = { ...v2.cars[0]!, doors: undefined };
    const schema = buildVehicleSchema(carWithoutDoors, v2);
    expect("numberOfDoors" in schema).toBe(false);
  });

  it("description copia do car (sem truncar)", () => {
    const v2 = makeV2();
    const car = v2.cars[0]!;
    const schema = buildVehicleSchema(car, v2);
    expect(asRecord(schema).description).toBe(car.description);
  });
});

describe("buildBreadcrumbSchema()", () => {
  it("@type BreadcrumbList + itemListElement em ordem", () => {
    const schema = buildBreadcrumbSchema([
      { name: "Início", item: `${BASE_URL}/sites/foo` },
      { name: "Estoque", item: `${BASE_URL}/sites/foo/estoque` },
    ]);
    expect(asRecord(schema)["@context"]).toBe("https://schema.org");
    expect(asRecord(schema)["@type"]).toBe("BreadcrumbList");
    expect(asRecord(schema).itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Início",
        item: `${BASE_URL}/sites/foo`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Estoque",
        item: `${BASE_URL}/sites/foo/estoque`,
      },
    ]);
  });

  it("position auto-incrementa começando em 1", () => {
    const schema = buildBreadcrumbSchema([
      { name: "A", item: "https://x/a" },
      { name: "B", item: "https://x/b" },
      { name: "C", item: "https://x/c" },
    ]);
    const positions = (
      asRecord(schema).itemListElement as Array<{ position: number }>
    ).map((i) => i.position);
    expect(positions).toEqual([1, 2, 3]);
  });
});

describe("buildWebSiteSchema()", () => {
  it("emite @context, @type WebSite e @id absoluto com fragment #website", () => {
    const schema = buildWebSiteSchema(makeV2());
    expect(asRecord(schema)["@context"]).toBe("https://schema.org");
    expect(asRecord(schema)["@type"]).toBe("WebSite");
    expect(asRecord(schema)["@id"]).toBe(
      `${BASE_URL}/sites/${makeV2().business_slug}#website`,
    );
  });

  it("name = business_name e url absoluta do site", () => {
    const schema = buildWebSiteSchema(makeV2());
    expect(asRecord(schema).name).toBe("Auto Fit Multimarcas");
    expect(asRecord(schema).url).toBe(
      `${BASE_URL}/sites/auto-fit-multimarcas`,
    );
  });

  it("inLanguage = 'pt-BR' sempre presente (V1 monolíngue)", () => {
    const schema = buildWebSiteSchema(makeV2());
    expect(asRecord(schema).inLanguage).toBe("pt-BR");
  });

  it("publisher cross-references o Organization (#org fragment)", () => {
    const schema = buildWebSiteSchema(makeV2());
    expect(asRecord(schema).publisher).toEqual({
      "@id": `${BASE_URL}/sites/auto-fit-multimarcas#org`,
    });
  });

  it("V1 NÃO emite potentialAction/SearchAction (omitido até V2)", () => {
    const schema = buildWebSiteSchema(makeV2());
    expect("potentialAction" in asRecord(schema)).toBe(false);
  });
});

describe("buildSitewideGraph()", () => {
  it("emite @context + @graph com AutoDealer, WebSite, Organization, LocalBusiness", () => {
    const graph = buildSitewideGraph(makeV2());
    expect(graph["@context"]).toBe("https://schema.org");
    const types = (graph["@graph"] as Array<{ "@type": string }>).map(
      (n) => n["@type"],
    );
    expect(types).toEqual([
      "AutoDealer",
      "WebSite",
      "Organization",
      "LocalBusiness",
    ]);
  });

  it("nodes do @graph NÃO duplicam @context (já no root)", () => {
    const graph = buildSitewideGraph(makeV2());
    for (const node of graph["@graph"] as Array<Record<string, unknown>>) {
      expect("@context" in node).toBe(false);
    }
  });

  it("WebSite node linka publisher ao Organization via @id (cross-reference)", () => {
    const graph = buildSitewideGraph(makeV2());
    const website = (graph["@graph"] as Array<Record<string, unknown>>).find(
      (n) => n["@type"] === "WebSite",
    );
    expect(website).toBeDefined();
    expect((website!.publisher as Record<string, unknown>)["@id"]).toBe(
      `${BASE_URL}/sites/auto-fit-multimarcas#org`,
    );
  });
});
