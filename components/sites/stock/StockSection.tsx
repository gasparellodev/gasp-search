import "server-only";

import type { SiteVariablesV2 } from "@/types/lead-site";
import {
  parseStockFilters,
  serializeStockFilters,
  type ParsedStockFilters,
} from "@/lib/sites/stock-search-params";

import { StockClientView } from "./StockClientView";

interface StockSectionProps {
  variables: SiteVariablesV2;
  slug: string;
  initialFilters?: ParsedStockFilters;
  /** Compat legado de #164; convertido para `c=` no novo filtro. */
  categoriaFilter?: string | null | undefined;
}

export function StockSection({
  variables,
  initialFilters,
  categoriaFilter,
  slug,
}: StockSectionProps) {
  const filters =
    initialFilters ??
    parseStockFilters(
      categoriaFilter ? { categoria: categoriaFilter } : {},
    );

  return (
    <StockClientView
      key={serializeStockFilters(filters)}
      cars={variables.cars}
      slug={slug}
      whatsappPhone={variables.whatsapp}
      businessName={variables.business_name}
      initialFilters={filters}
    />
  );
}
