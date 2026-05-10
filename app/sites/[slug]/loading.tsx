import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton da rota `/sites/[slug]` (Home — issue #202).
 *
 * Server Component. Anatomia: hero 16:9 + 3 categorias + 3 seções
 * narrow. Usa `<Skeleton>` shadcn (animate-pulse já respeita
 * `prefers-reduced-motion` via reset global em `globals.css`).
 */
export default function SiteHomeLoading() {
  return (
    <div data-testid="site-home-loading" className="min-h-dvh bg-background">
      {/* Header placeholder (logo + nav) */}
      <div className="sticky top-0 z-30 border-b border-foreground/10 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:h-20 md:px-8">
          <Skeleton className="h-10 w-36" />
          <div className="hidden items-center gap-2 md:flex">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>

      {/* Hero 16:9 */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
        <Skeleton className="aspect-[16/9] w-full rounded-3xl" />
      </section>

      {/* Categories — 3 cards */}
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <Skeleton className="mb-6 h-7 w-48" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
        </div>
      </section>

      {/* Recent sales placeholder */}
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <Skeleton className="mb-6 h-7 w-56" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
        </div>
      </section>
    </div>
  );
}
