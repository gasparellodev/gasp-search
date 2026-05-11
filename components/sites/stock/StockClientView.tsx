"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  applyStockFilters,
  buildStockFilterFacets,
  countActiveStockFilters,
  parseStockFilters,
  serializeStockFilters,
  type ParsedStockFilters,
} from "@/lib/sites/stock-search-params";
import type { SiteCar } from "@/types/lead-site";

import { StockFilterDrawer } from "./StockFilterDrawer";
import { StockFilterSidebar } from "./StockFilterSidebar";
import { StockGrid } from "./StockGrid";
import { StockSearchBar } from "./StockSearchBar";

interface StockClientViewProps {
  cars: ReadonlyArray<SiteCar>;
  slug: string;
  initialFilters: ParsedStockFilters;
}

export function StockClientView({
  cars,
  slug,
  initialFilters,
}: StockClientViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<ParsedStockFilters>(initialFilters);
  const skipNextReplaceRef = useRef(true);

  const facets = useMemo(() => buildStockFilterFacets(cars), [cars]);
  const filtered = useMemo(
    () =>
      applyStockFilters(cars, filters).toSorted(
        (a, b) => Number(b.featured) - Number(a.featured),
      ),
    [cars, filters],
  );

  useEffect(() => {
    if (skipNextReplaceRef.current) {
      skipNextReplaceRef.current = false;
      return;
    }
    const timeout = window.setTimeout(() => {
      const qs = serializeStockFilters(filters);
      const href = qs.length > 0 ? `/sites/${slug}/estoque?${qs}` : `/sites/${slug}/estoque`;
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [filters, router, slug, startTransition]);

  const sort = filters.passthrough.sort ?? "featured";
  const activeFilterCount = countActiveStockFilters(filters);

  function updateFilters(next: ParsedStockFilters) {
    setFilters(next);
  }

  function updateSearch(search: string) {
    setFilters((current) => ({ ...current, search }));
  }

  function updateSort(sortValue: string) {
    setFilters((current) => ({
      ...current,
      passthrough: { ...current.passthrough, sort: sortValue },
    }));
  }

  function clearFilters() {
    const empty = parseStockFilters({});
    setFilters(empty);
    setDrawerOpen(false);
    startTransition(() => {
      router.replace(`/sites/${slug}/estoque`, { scroll: false });
    });
  }

  return (
    <section data-testid="stock-client-view" className="w-full bg-background">
      <StockSearchBar
        search={filters.search ?? ""}
        sort={sort}
        activeFilterCount={activeFilterCount}
        resultCount={filtered.length}
        totalCount={cars.length}
        onSearchChange={updateSearch}
        onSortChange={updateSort}
        onOpenFilters={() => setDrawerOpen(true)}
      />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:px-8 lg:grid-cols-12 lg:py-10">
        <h2 className="sr-only">Veículos disponíveis</h2>
        <StockFilterSidebar
          facets={facets}
          filters={filters}
          onFiltersChange={(next) => updateFilters(next as ParsedStockFilters)}
          onClear={clearFilters}
        />
        <div className="lg:col-span-9">
          {filtered.length === 0 ? (
            <StockEmptyState slug={slug} onClear={clearFilters} />
          ) : (
            <StockGrid cars={filtered} slug={slug} />
          )}
        </div>
      </div>
      <StockFilterDrawer
        open={drawerOpen}
        facets={facets}
        filters={filters}
        onOpenChange={setDrawerOpen}
        onFiltersChange={(next) => updateFilters(next as ParsedStockFilters)}
        onClear={clearFilters}
      />
    </section>
  );
}

function StockEmptyState({
  slug,
  onClear,
}: {
  slug: string;
  onClear: () => void;
}) {
  return (
    <div
      data-testid="stock-empty"
      className="mx-auto flex max-w-md flex-col items-center gap-6 px-6 py-20 text-center"
    >
      <div className="flex size-24 items-center justify-center rounded-full bg-[var(--auto-muted,#f5f5f5)] text-3xl">
        0
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-normal text-foreground">
          Nenhum carro encontrado
        </h2>
        <p className="text-base text-foreground/70 md:text-lg">
          Tente remover algum filtro ou veja o estoque completo.
        </p>
      </div>
      <Link
        href={`/sites/${slug}/estoque`}
        onClick={onClear}
        style={{
          backgroundColor: "var(--site-primary)",
          color: "var(--site-text-on-primary)",
        }}
        className="inline-flex h-12 items-center justify-center rounded-[var(--auto-radius-md,8px)] px-6 text-sm font-medium transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
      >
        Ver estoque completo
      </Link>
    </div>
  );
}
