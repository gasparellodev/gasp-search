"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { paginate, parseStockPage, STOCK_PAGE_SIZE } from "@/lib/stock/pagination";
import {
  parseStockSortKey,
  sortCars,
  type StockSortKey,
} from "@/lib/stock/sort";
import {
  applyStockFilters,
  buildStockFilterFacets,
  countActiveStockFilters,
  parseStockFilters,
  serializeStockFilters,
  type ParsedStockFilters,
} from "@/lib/sites/stock-search-params";
import type { SiteCar } from "@/types/lead-site";

import { StockEmptyState } from "./StockEmptyState";
import { StockFilterDrawer } from "./StockFilterDrawer";
import { StockFilterSidebar } from "./StockFilterSidebar";
import { StockGrid } from "./StockGrid";
import { StockPagination } from "./StockPagination";
import { StockSearchBar } from "./StockSearchBar";

interface StockClientViewProps {
  cars: ReadonlyArray<SiteCar>;
  slug: string;
  whatsappPhone: string;
  businessName: string;
  initialFilters: ParsedStockFilters;
}

export function StockClientView({
  cars,
  slug,
  whatsappPhone,
  businessName,
  initialFilters,
}: StockClientViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<ParsedStockFilters>(initialFilters);
  const skipNextReplaceRef = useRef(true);

  const facets = useMemo(() => buildStockFilterFacets(cars), [cars]);
  const sort = parseStockSortKey(filters.passthrough.sort);
  const currentPage = parseStockPage(filters.passthrough.page);
  const filtered = useMemo(
    () => applyStockFilters(cars, filters),
    [cars, filters],
  );
  const sorted = useMemo(() => sortCars(filtered, sort), [filtered, sort]);
  const paginated = useMemo(
    () => paginate(sorted, currentPage, STOCK_PAGE_SIZE),
    [currentPage, sorted],
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

  const activeFilterCount = countActiveStockFilters(filters);

  function updateFilters(next: ParsedStockFilters) {
    setFilters(resetPage(next));
  }

  function updateSearch(search: string) {
    setFilters((current) => resetPage({ ...current, search }));
  }

  function updateSort(sortValue: StockSortKey) {
    setFilters((current) => {
      const passthrough = withoutPage(current.passthrough);
      if (sortValue === "most_recent") {
        delete passthrough.sort;
      } else {
        passthrough.sort = sortValue;
      }
      return { ...current, passthrough };
    });
  }

  function updatePage(page: number) {
    setFilters((current) => {
      const passthrough = { ...current.passthrough };
      if (page <= 1) {
        delete passthrough.page;
      } else {
        passthrough.page = String(page);
      }
      return { ...current, passthrough };
    });
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
            <>
              <StockGrid
                cars={paginated.items}
                slug={slug}
                whatsappPhone={whatsappPhone}
                businessName={businessName}
              />
              <StockPagination
                page={paginated.page}
                totalPages={paginated.totalPages}
                pageSize={paginated.perPage}
                hasPreviousPage={paginated.hasPreviousPage}
                hasNextPage={paginated.hasNextPage}
                onPageChange={updatePage}
              />
            </>
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

function resetPage(filters: ParsedStockFilters): ParsedStockFilters {
  return { ...filters, passthrough: withoutPage(filters.passthrough) };
}

function withoutPage(passthrough: Record<string, string>): Record<string, string> {
  const next = { ...passthrough };
  delete next.page;
  return next;
}
