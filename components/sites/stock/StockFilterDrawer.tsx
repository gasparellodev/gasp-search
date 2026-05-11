"use client";

import { X } from "lucide-react";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type {
  StockFilterFacets,
  StockFilters,
} from "@/lib/sites/stock-search-params";

import { StockFilterControls } from "./StockFilterControls";

interface StockFilterDrawerProps {
  open: boolean;
  facets: StockFilterFacets;
  filters: StockFilters;
  onOpenChange: (open: boolean) => void;
  onFiltersChange: (filters: StockFilters) => void;
  onClear: () => void;
}

export function StockFilterDrawer({
  open,
  facets,
  filters,
  onOpenChange,
  onFiltersChange,
  onClear,
}: StockFilterDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent
        data-testid="stock-filter-drawer-content"
        className="z-[var(--z-stock-drawer,60)] max-h-[90dvh] overflow-hidden rounded-t-[var(--auto-radius-md,8px)]"
      >
        <DrawerHeader className="flex-row items-center justify-between border-b border-[var(--auto-border,#e5e5e5)] text-left">
          <DrawerTitle>Filtros</DrawerTitle>
          <button
            type="button"
            aria-label="Fechar filtros"
            onClick={() => onOpenChange(false)}
            className="inline-flex size-10 items-center justify-center rounded-full text-[var(--auto-foreground,#0a0a0a)] transition hover:bg-[var(--auto-muted,#f5f5f5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-primary,#0a0a0a)]/30"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </DrawerHeader>
        <div className="overflow-y-auto px-5 py-4">
          <StockFilterControls
            facets={facets}
            filters={filters}
            onFiltersChange={onFiltersChange}
            onClear={onClear}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
