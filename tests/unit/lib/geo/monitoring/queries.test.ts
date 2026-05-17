import { describe, expect, it } from "vitest";
import { SITE_FIXTURE } from "@/tests/unit/components/sites/site-fixtures";
import { buildAmostralQueries } from "@/lib/geo/monitoring/queries";
import type { SiteVariablesV2 } from "@/types/lead-site";

// Minimal V2 fixture with all fields to exercise every query slot
const fullVariables: SiteVariablesV2 = {
  ...SITE_FIXTURE,
  business_name: "Touring Cars",
  address: {
    street: "Av. Boa Viagem",
    number: "100",
    neighborhood: "Boa Viagem",
    city: "Recife",
    state: "PE",
    zip: "51020-000",
    country: "BR" as const,
  },
  cars: [
    ...SITE_FIXTURE.cars,
  ],
};

describe("buildAmostralQueries", () => {
  it("returns exactly 5 queries for full variables", () => {
    const queries = buildAmostralQueries(fullVariables);
    expect(queries).toHaveLength(5);
  });

  it("includes the business name as first query", () => {
    const queries = buildAmostralQueries(fullVariables);
    expect(queries[0]).toBe("Touring Cars");
  });

  it("includes city-based generic query", () => {
    const queries = buildAmostralQueries(fullVariables);
    expect(queries.some((q) => q.includes("Recife"))).toBe(true);
  });

  it("includes brand + city query when brands are available", () => {
    const queries = buildAmostralQueries(fullVariables);
    // SITE_FIXTURE cars include Toyota (Corolla) — should appear in queries
    const hasBrandCity = queries.some(
      (q) => q.includes("seminovos em") && q.includes("Recife"),
    );
    expect(hasBrandCity).toBe(true);
  });

  it("caps at 5 even with many brands", () => {
    const variables: SiteVariablesV2 = {
      ...fullVariables,
      cars: [
        ...fullVariables.cars,
        // Add extra brands that would push beyond 5 queries if uncapped
        { ...fullVariables.cars[0]!, brand: "Honda", model: "Civic", slug: "honda-civic-2023-xxxx" },
        { ...fullVariables.cars[0]!, brand: "Fiat", model: "Pulse", slug: "fiat-pulse-2023-xxxx" },
        { ...fullVariables.cars[0]!, brand: "Renault", model: "Kwid", slug: "renault-kwid-2023-xxxx" },
      ],
    };
    const queries = buildAmostralQueries(variables);
    expect(queries.length).toBeLessThanOrEqual(5);
  });

  it("handles missing city gracefully — no crash", () => {
    const variables: SiteVariablesV2 = {
      ...fullVariables,
      address: null,
    };
    const queries = buildAmostralQueries(variables);
    expect(queries.length).toBeGreaterThanOrEqual(1);
    expect(queries.every((q) => typeof q === "string" && q.length > 0)).toBe(
      true,
    );
  });

  it("handles missing city — still returns business name and generic fallback", () => {
    const variables: SiteVariablesV2 = {
      ...fullVariables,
      address: null,
    };
    const queries = buildAmostralQueries(variables);
    expect(queries[0]).toBe("Touring Cars");
    // Generic fallback without city
    expect(queries.some((q) => q.includes("seminovos premium"))).toBe(true);
  });

  it("handles empty cars array — no crash", () => {
    // SiteVariablesV2 TS type is SiteCar[] (min(4) is Zod-runtime only)
    const variables: SiteVariablesV2 = {
      ...fullVariables,
      cars: [],
    };
    const queries = buildAmostralQueries(variables);
    expect(queries.length).toBeGreaterThanOrEqual(1);
    expect(queries.every((q) => typeof q === "string" && q.length > 0)).toBe(
      true,
    );
  });

  it("deduplicates brands (same brand multiple cars)", () => {
    const toyotaCar = fullVariables.cars[0]!;
    const variables: SiteVariablesV2 = {
      ...fullVariables,
      cars: [toyotaCar, toyotaCar, toyotaCar, toyotaCar],
    };
    const queries = buildAmostralQueries(variables);
    // Should have at most 1 brand-specific query since only 1 unique brand
    const brandQueries = queries.filter((q) => q.includes("seminovos em"));
    expect(brandQueries.length).toBeLessThanOrEqual(1);
  });

  it("trims whitespace from business_name", () => {
    const variables: SiteVariablesV2 = {
      ...fullVariables,
      business_name: "  Garagem Premium  ",
    };
    const queries = buildAmostralQueries(variables);
    expect(queries[0]).toBe("Garagem Premium");
  });

  it("returns at least 1 query even with minimal variables", () => {
    const variables: SiteVariablesV2 = {
      ...fullVariables,
      business_name: "Auto X",
      address: null,
      cars: [],
    };
    const queries = buildAmostralQueries(variables);
    expect(queries.length).toBeGreaterThanOrEqual(1);
  });
});
