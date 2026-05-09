import "server-only";

import Image from "next/image";
import { CheckCircle } from "lucide-react";

import type { SiteVariables } from "@/types/lead-site";

interface HomeRecentSalesProps {
  /** Vendas recentes — sempre length 3 (`SiteVariables.recent_sales`). */
  recent_sales: SiteVariables["recent_sales"];
}

/**
 * Bloco "Vendas recentes" da Home (Phase 7 — issue #162).
 *
 * Server Component. Layout: 3 cards lado-a-lado no desktop e
 * horizontal-scroll snap no mobile (`snap-x snap-mandatory
 * overflow-x-auto`). Cada card mostra a imagem, o `car_name` e um
 * ícone `CheckCircle` indicando "vendido".
 */
export function HomeRecentSales({ recent_sales }: HomeRecentSalesProps) {
  return (
    <section
      data-testid="home-recent-sales"
      className="w-full bg-background"
      aria-labelledby="home-recent-sales-title"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
        <h2
          id="home-recent-sales-title"
          className="mb-8 text-2xl font-semibold tracking-tight text-foreground md:mb-10 md:text-3xl"
        >
          Vendas recentes
        </h2>

        <ul
          data-testid="recent-sales-scroller"
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible"
        >
          {recent_sales.map((sale) => (
            <li
              key={sale.car_name}
              className="relative aspect-[4/3] w-[85%] flex-none snap-start overflow-hidden rounded-3xl bg-foreground/5 md:w-auto"
            >
              <Image
                src={sale.image_url}
                alt={`Venda recente — ${sale.car_name}`}
                fill
                sizes="(max-width: 768px) 85vw, 33vw"
                className="object-cover"
                unoptimized
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-5 py-4 text-white md:px-6 md:py-5">
                <span className="text-base font-semibold md:text-lg">
                  {sale.car_name}
                </span>
                <CheckCircle aria-hidden className="size-5 md:size-6" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
