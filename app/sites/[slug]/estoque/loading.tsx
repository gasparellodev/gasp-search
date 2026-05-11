import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton da rota `/sites/[slug]/estoque` (issue #202).
 *
 * Anatomia: filter chips + grid 1/2/3 cols com 6 cards 4:3.
 * Cards usam raio 8px para casar com `<CarCard>` e evitar shift visual.
 */
export default function EstoqueLoading() {
  const placeholders = Array.from({ length: 6 });
  return (
    <div data-testid="site-estoque-loading" className="min-h-dvh bg-background">
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
        <Skeleton className="mb-3 h-6 w-32" />
        <Skeleton className="mb-8 h-10 w-2/3" />

        {/* Filter chips */}
        <div className="mb-8 flex flex-wrap gap-2">
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-16 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {placeholders.map((_, idx) => (
            <div key={idx} className="flex flex-col gap-3">
              <Skeleton className="aspect-[4/3] w-full rounded-[var(--auto-radius-md,8px)]" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-6 w-32" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
