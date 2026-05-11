"use client";

import type {
  StockFilterFacets,
  StockFilters,
} from "@/lib/sites/stock-search-params";

import { StockFilterControls } from "./StockFilterControls";

interface StockFilterSidebarProps {
  facets: StockFilterFacets;
  filters: StockFilters;
  onFiltersChange: (filters: StockFilters) => void;
  onClear: () => void;
}

export function StockFilterSidebar(props: StockFilterSidebarProps) {
  return (
    <aside
      data-testid="stock-filter-sidebar"
      className="hidden lg:col-span-3 lg:block"
      aria-label="Filtros de estoque"
    >
      <div className="sticky top-[calc(var(--site-header-h,72px)+76px)] rounded-[var(--auto-radius-md,8px)] border border-[var(--auto-border,#e5e5e5)] bg-[var(--auto-surface,#fff)] p-5">
        <StockFilterControls {...props} />
      </div>
    </aside>
  );
}
