"use client";

import { Filter, Search } from "lucide-react";

interface StockSearchBarProps {
  search: string;
  sort: string;
  activeFilterCount: number;
  resultCount: number;
  totalCount: number;
  onSearchChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onOpenFilters: () => void;
}

export function StockSearchBar({
  search,
  sort,
  activeFilterCount,
  resultCount,
  totalCount,
  onSearchChange,
  onSortChange,
  onOpenFilters,
}: StockSearchBarProps) {
  return (
    <div className="sticky top-[var(--site-header-h,72px)] z-[var(--z-stock-search,40)] border-b border-[var(--auto-border,#e5e5e5)] bg-[rgb(255_255_255_/_0.92)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:px-8 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--auto-muted-foreground,#737373)]"
          />
          <label htmlFor="stock-search" className="sr-only">
            Buscar por marca ou modelo
          </label>
          <input
            id="stock-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar por marca ou modelo"
            className="h-11 w-full rounded-[var(--auto-radius-md,8px)] border border-[var(--auto-border,#e5e5e5)] bg-[var(--auto-surface,#fff)] pl-10 pr-3 text-sm text-[var(--auto-foreground,#0a0a0a)] outline-none transition focus:border-[var(--auto-primary,#0a0a0a)] focus:ring-2 focus:ring-[var(--auto-primary,#0a0a0a)]/20"
          />
        </div>

        <div className="flex items-center gap-3">
          <p className="hidden min-w-max text-sm text-[var(--auto-muted-foreground,#737373)] sm:block">
            {resultCount} de {totalCount} carros
          </p>
          <label htmlFor="stock-sort" className="sr-only">
            Ordenar estoque
          </label>
          <select
            id="stock-sort"
            value={sort}
            onChange={(event) => onSortChange(event.target.value)}
            className="h-11 min-w-[150px] rounded-[var(--auto-radius-md,8px)] border border-[var(--auto-border,#e5e5e5)] bg-[var(--auto-surface,#fff)] px-3 text-sm text-[var(--auto-foreground,#0a0a0a)] outline-none transition focus:border-[var(--auto-primary,#0a0a0a)] focus:ring-2 focus:ring-[var(--auto-primary,#0a0a0a)]/20"
          >
            <option value="featured">Destaques</option>
            <option value="price">Menor preço</option>
            <option value="year">Mais novos</option>
            <option value="km">Menor km</option>
          </select>
          <button
            type="button"
            aria-label={
              activeFilterCount > 0
                ? `Filtros ${activeFilterCount}`
                : "Filtros"
            }
            onClick={onOpenFilters}
            className="inline-flex h-11 items-center gap-2 rounded-[var(--auto-radius-md,8px)] border border-[var(--auto-border,#e5e5e5)] bg-[var(--auto-surface,#fff)] px-3 text-sm font-medium text-[var(--auto-foreground,#0a0a0a)] transition hover:border-[var(--auto-border-strong,#a3a3a3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-primary,#0a0a0a)]/30 lg:hidden"
          >
            <Filter aria-hidden="true" className="size-4" />
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--auto-primary,#0a0a0a)] px-1.5 text-xs text-[var(--auto-on-primary,#fafafa)]">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
