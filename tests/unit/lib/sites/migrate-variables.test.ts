/**
 * Tests para `lib/sites/migrate-variables.ts` (issue #197).
 *
 * Cobre:
 *   - `isV1` / `isV2` discrimination
 *   - `migrateV1ToV2` round-trip preservando campos identitários
 *   - `readSiteVariables` aceita v1 (com warn) E v2 (sem warn)
 *   - Corner cases (address_line null, malformed, gallery limites)
 *   - Throws determinísticos (null, empty, invalid v2)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ZodError } from "zod";

import {
  isV1,
  migrateV1ToV2,
  readSiteVariables,
  readSiteVariablesSafe,
} from "@/lib/sites/migrate-variables";
import { SiteVariablesV2 } from "@/types/lead-site";
import { fixtureSiteVariablesV1 } from "@/tests/fixtures/site-variables/site-variables-v1";
import { fixtureSiteVariablesV2 } from "@/tests/fixtures/site-variables/site-variables-v2";
import {
  fixtureCornerAddressNull,
  fixtureCornerAddressMalformed,
  fixtureCornerGallery8,
  fixtureCornerNoTestimonials,
  fixtureCornerNull,
  fixtureCornerEmpty,
  fixtureCornerInvalidV2,
} from "@/tests/fixtures/site-variables/site-variables-corner";

describe("migrate-variables", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // ========================================================================
  // isV1
  // ========================================================================
  describe("isV1", () => {
    it("returns true for v1 payload (no schema_version)", () => {
      expect(isV1(fixtureSiteVariablesV1)).toBe(true);
    });

    it("returns false for v2 payload (has schema_version: 2)", () => {
      expect(isV1(fixtureSiteVariablesV2)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isV1(null)).toBe(false);
    });

    it("returns false for empty object", () => {
      expect(isV1({})).toBe(false);
    });

    it("returns false for primitive (string)", () => {
      expect(isV1("foo" as unknown)).toBe(false);
    });
  });

  // ========================================================================
  // migrateV1ToV2 — happy path
  // ========================================================================
  describe("migrateV1ToV2", () => {
    it("produces v2 output with schema_version: 2", () => {
      const result = migrateV1ToV2(fixtureSiteVariablesV1);
      expect(result.schema_version).toBe(2);
    });

    it("output passes SiteVariablesV2.safeParse", () => {
      const result = migrateV1ToV2(fixtureSiteVariablesV1);
      const parsed = SiteVariablesV2.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it("preserves business_name, slogan, business_slug", () => {
      const result = migrateV1ToV2(fixtureSiteVariablesV1);
      expect(result.business_name).toBe(fixtureSiteVariablesV1.business_name);
      expect(result.slogan).toBe(fixtureSiteVariablesV1.slogan);
      expect(result.business_slug).toBe(fixtureSiteVariablesV1.business_slug);
    });

    it("nests brand_assets correctly", () => {
      const result = migrateV1ToV2(fixtureSiteVariablesV1);
      expect(result.brand_assets.primary_color).toBe(
        fixtureSiteVariablesV1.primary_color,
      );
      expect(result.brand_assets.text_on_primary).toBe(
        fixtureSiteVariablesV1.text_on_primary,
      );
      expect(result.brand_assets.logo_url).toBe(fixtureSiteVariablesV1.logo_url);
      expect(result.brand_assets.hero_image_url).toBe(
        fixtureSiteVariablesV1.hero_image_url,
      );
      expect(result.brand_assets.about_image_url).toBe(
        fixtureSiteVariablesV1.about_image_url,
      );
      expect(result.brand_assets.contact_image_url).toBe(
        fixtureSiteVariablesV1.contact_hero_image_url,
      );
      expect(result.brand_assets.car_placeholders).toEqual([]);
    });

    it("parses address_line into structured Address", () => {
      const result = migrateV1ToV2(fixtureSiteVariablesV1);
      expect(result.address).not.toBeNull();
      expect(result.address?.street).toBe("Av. Paulista");
      expect(result.address?.number).toBe("1000");
      expect(result.address?.neighborhood).toBe("Bela Vista");
      expect(result.address?.city).toBe("São Paulo");
      expect(result.address?.state).toBe("SP");
      expect(result.address?.zip).toBe("01310-100");
      expect(result.address?.country).toBe("BR");
    });

    it("preserves cars[] essentials and adds v2 fields", () => {
      const result = migrateV1ToV2(fixtureSiteVariablesV1);
      // Cast: fixtureSiteVariablesV1 é Record<string,unknown> defensivamente
      // (fonte v1 não-validada). Em runtime a estrutura é a esperada via
      // SiteVariablesV1.parse dentro do migrator.
      const carsV1 = fixtureSiteVariablesV1["cars"] as Array<{
        brand: string;
        model: string;
        year: number;
        km: number;
        gallery_urls: string[];
      }>;
      const carsV2 = result.cars;

      expect(carsV2).toHaveLength(carsV1.length);
      carsV2.forEach((car, idx) => {
        expect(car.brand).toBe(carsV1[idx]!.brand);
        expect(car.model).toBe(carsV1[idx]!.model);
        expect(car.year).toBe(carsV1[idx]!.year);
        expect(car.km).toBe(carsV1[idx]!.km);
        expect(car.category).toBe("Sedan"); // default migration
        expect(car.plates_visible).toBe(false);
        expect(car.photos).toEqual(carsV1[idx]!.gallery_urls);
      });
    });

    it("throws ZodError when input is not v1 shape", () => {
      expect(() => migrateV1ToV2({ broken: true })).toThrow(ZodError);
    });
  });

  // ========================================================================
  // readSiteVariables — happy paths
  // ========================================================================
  describe("readSiteVariables", () => {
    it("accepts v2 fixture without invoking warn", () => {
      const result = readSiteVariables(fixtureSiteVariablesV2);
      expect(result.schema_version).toBe(2);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("accepts v1 fixture and migrates with warn", () => {
      const result = readSiteVariables(fixtureSiteVariablesV1);
      expect(result.schema_version).toBe(2);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        "[migrate-variables] v1 fallback hit",
        expect.objectContaining({
          has_address_line: true,
          has_brand_assets: false,
          business_slug: "auto-fit-multimarcas",
          cars_count: 4,
        }),
      );
    });

    // ======================================================================
    // Corner cases
    // ======================================================================
    it("corner: address_line null produces address: null", () => {
      const result = readSiteVariables(fixtureCornerAddressNull);
      expect(result.address).toBeNull();
    });

    it("corner: address_line malformed produces address: null", () => {
      const result = readSiteVariables(fixtureCornerAddressMalformed);
      expect(result.address).toBeNull();
    });

    it("corner: gallery_urls with 8 items preserved fully in photos", () => {
      const result = readSiteVariables(fixtureCornerGallery8);
      const firstCar = result.cars[0]!;
      expect(firstCar.photos).toHaveLength(8);
    });

    it("corner: testimonials absent in v1 → omitted in v2", () => {
      const result = readSiteVariables(fixtureCornerNoTestimonials);
      expect(result.testimonials).toBeUndefined();
    });

    it("corner: null payload throws ZodError (not NPE)", () => {
      expect(() => readSiteVariables(fixtureCornerNull)).toThrow(ZodError);
    });

    it("corner: empty object throws ZodError", () => {
      expect(() => readSiteVariables(fixtureCornerEmpty)).toThrow(ZodError);
    });

    it("corner: invalid v2 (schema_version: 2 + missing fields) throws ZodError without v1 fallback", () => {
      expect(() => readSiteVariables(fixtureCornerInvalidV2)).toThrow(ZodError);
      // schema_version: 2 → não cai em isV1 → throws diretamente
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // readSiteVariablesSafe
  // ========================================================================
  describe("readSiteVariablesSafe", () => {
    it("returns success: true for valid v2", () => {
      const result = readSiteVariablesSafe(fixtureSiteVariablesV2);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schema_version).toBe(2);
      }
    });

    it("returns success: true for valid v1 (migrated)", () => {
      const result = readSiteVariablesSafe(fixtureSiteVariablesV1);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schema_version).toBe(2);
      }
    });

    it("returns success: false with ZodError for null", () => {
      const result = readSiteVariablesSafe(null);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ZodError);
      }
    });

    it("returns success: false for empty object", () => {
      const result = readSiteVariablesSafe({});
      expect(result.success).toBe(false);
    });
  });
});
