import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton da rota `/sites/[slug]/estoque/[carSlug]` (issue #202).
 *
 * Anatomia: split 7/5 desktop (gallery + info), datasheet grid abaixo.
 */
export default function CarDetailLoading() {
  return (
    <div data-testid="site-car-detail-loading" className="min-h-dvh bg-background">
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
        <Skeleton className="mb-6 h-5 w-44" />

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-12 lg:gap-16">
          {/* Gallery */}
          <div className="flex flex-col gap-3">
            <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
            <div className="flex gap-2">
              <Skeleton className="size-16 rounded-md" />
              <Skeleton className="size-16 rounded-md" />
              <Skeleton className="size-16 rounded-md" />
              <Skeleton className="size-16 rounded-md" />
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col gap-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-12 w-3/4" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-16 rounded-full" />
            </div>
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-12 w-44 rounded-full" />
            <div className="mt-4 flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>

        {/* Datasheet */}
        <div className="mt-16 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 md:mt-20 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="flex flex-col gap-1 border-b border-foreground/10 pb-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
