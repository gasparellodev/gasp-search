import "server-only";

// ===========================================================================
// Phase 7 / Frente 04 GEO/AI — #G5
// Amostral query generator for brand mention monitoring.
// ===========================================================================
//
// Generates up to 5 representative natural-language queries from
// SiteVariablesV2, mimicking how a car buyer would search on Perplexity
// or ChatGPT. These queries are then checked via MonitoringProvider.check().

import type { SiteVariablesV2 } from "@/types/lead-site";

/**
 * Generates up to 5 amostral queries from the site's variables.
 *
 * Guarantees: never throws, always returns at least 1 query (the fallback
 * generic "loja de carros seminovos" when no structured data is available),
 * and always caps at 5.
 */
export function buildAmostralQueries(variables: SiteVariablesV2): string[] {
  const queries: string[] = [];

  const name = variables.business_name?.trim();
  const city =
    variables.address?.city?.trim() ??
    // V1 flat fallback: address_line may hold "City, State"
    null;

  const brands = Array.from(
    new Set(
      (variables.cars ?? [])
        .map((c) => c.brand?.trim())
        .filter((b): b is string => Boolean(b)),
    ),
  );

  // 1. Direct brand name lookup
  if (name) queries.push(name);

  // 2. Generic category + city
  if (city) queries.push(`concessionária em ${city}`);

  // 3. Top brand + city (most specific, high commercial intent)
  const firstBrand = brands[0];
  if (firstBrand !== undefined && city) {
    queries.push(`${firstBrand} seminovos em ${city}`);
  }

  // 4. Second brand + city (diversity across inventory)
  const secondBrand = brands[1];
  if (secondBrand !== undefined && city) {
    queries.push(`onde comprar ${secondBrand} em ${city}`);
  }

  // 5. Generic premium category fallback — always useful as AI citation signal
  if (city) {
    queries.push(`loja de carros usados premium ${city}`);
  } else {
    queries.push(`loja de carros seminovos premium`);
  }

  return queries.slice(0, 5);
}
