import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton da rota `/sites/[slug]/anunciar` (issue #202).
 *
 * Anatomia: hero compacto + form sequencial single-column.
 */
export default function AnunciarLoading() {
  return (
    <div data-testid="site-anunciar-loading" className="min-h-dvh bg-background">
      <section className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-20">
        <div className="flex flex-col items-start gap-5">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-32 w-full rounded-md" />
          <Skeleton className="h-12 w-44 rounded-full" />
        </div>
      </section>
    </div>
  );
}
