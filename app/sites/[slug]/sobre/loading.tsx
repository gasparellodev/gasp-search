import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton da rota `/sites/[slug]/sobre` (issue #202).
 *
 * Anatomia: hero split 50/50 (texto + foto) + 3 cards (missão/visão/valores).
 */
export default function SobreLoading() {
  return (
    <div data-testid="site-sobre-loading" className="min-h-dvh bg-background">
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-20">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-12 lg:gap-16">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="aspect-[4/3] w-full rounded-3xl md:aspect-[5/4]" />
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:mt-16 md:grid-cols-2">
          <Skeleton className="h-48 w-full rounded-3xl" />
          <Skeleton className="h-48 w-full rounded-3xl" />
        </div>

        <Skeleton className="mt-6 h-56 w-full rounded-3xl md:mt-8" />
      </section>
    </div>
  );
}
