import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton da rota `/sites/[slug]/contato` (issue #202).
 *
 * Anatomia: split 50/50 (canais + foto) + form embaixo.
 */
export default function ContatoLoading() {
  return (
    <div data-testid="site-contato-loading" className="min-h-dvh bg-background">
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-20">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-12 lg:gap-16">
          <div className="flex flex-col gap-5">
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-5 w-3/4" />
            <div className="mt-4 flex flex-col gap-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-3/5" />
            </div>
          </div>
          <Skeleton className="aspect-[4/3] w-full rounded-3xl md:aspect-[5/4]" />
        </div>

        <div className="mt-16 grid grid-cols-1 gap-4 md:mt-20">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-32 w-full rounded-md" />
          <Skeleton className="h-12 w-40 rounded-full" />
        </div>
      </section>
    </div>
  );
}
