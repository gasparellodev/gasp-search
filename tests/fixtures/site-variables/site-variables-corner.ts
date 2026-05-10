/**
 * Fixtures de corner-cases para `migrate-variables.test.ts`.
 *
 * Cada export é uma variação de v1 ou v2 testando um caminho específico
 * do helper `readSiteVariables` / `migrateV1ToV2`. Mantidos como `unknown`
 * para forçar o caller a usar `readSiteVariablesSafe`/`readSiteVariables`
 * (caminho real que `app/sites/[slug]/page.tsx` exercita).
 */

import { fixtureSiteVariablesV1 } from "./site-variables-v1";

/**
 * Corner A: `address_line: null`. Migrate deve produzir `address: null`
 * (Address é nullable em v2).
 */
export const fixtureCornerAddressNull: unknown = {
  ...fixtureSiteVariablesV1,
  address_line: null,
};

/**
 * Corner B: `address_line` mal-formado (não casa regex). Migrate retorna
 * `address: null` em fallback gracioso.
 */
export const fixtureCornerAddressMalformed: unknown = {
  ...fixtureSiteVariablesV1,
  address_line: "Rua mal formada 99 SP",
};

/**
 * Corner C: car com `gallery_urls` no limite máximo (8 items). Migrate
 * preserva todos em `photos`.
 */
export const fixtureCornerGallery8: unknown = {
  ...fixtureSiteVariablesV1,
  cars: fixtureSiteVariablesV1.cars.map((car, idx) =>
    idx === 0
      ? {
          ...car,
          gallery_urls: [
            "/assets/stock/m2.png",
            "/assets/stock/m2.png",
            "/assets/stock/m2.png",
            "/assets/stock/m2.png",
            "/assets/stock/m2.png",
            "/assets/stock/m2.png",
            "/assets/stock/m2.png",
            "/assets/stock/m2.png",
          ],
        }
      : car,
  ),
};

/**
 * Corner D: `testimonials` ausente em v1 (esperado — v1 não tem o campo).
 * Migrate gera v2 sem `testimonials` (campo é optional).
 */
export const fixtureCornerNoTestimonials: unknown = {
  ...fixtureSiteVariablesV1,
};

/**
 * Corner E: payload completamente inválido — `null`. Helper deve throw.
 */
export const fixtureCornerNull: unknown = null;

/**
 * Corner F: payload vazio. Helper deve throw `ZodError` (não NPE).
 */
export const fixtureCornerEmpty: unknown = {};

/**
 * Corner G: payload com `schema_version: 2` mas brand_assets ausente.
 * Helper deve throw `ZodError` (v2 strict — não cair em v1 fallback).
 */
export const fixtureCornerInvalidV2: unknown = {
  schema_version: 2,
  business_name: "Loja Sem Brand",
  // ... resto faltando — invalid v2
};
