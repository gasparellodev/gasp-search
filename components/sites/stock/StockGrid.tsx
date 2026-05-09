import "server-only";

import Image from "next/image";
import Link from "next/link";

import type { SiteCar } from "@/types/lead-site";

interface StockGridProps {
  /** Carros já filtrados/ordenados pelo `<StockSection>` parent. */
  cars: ReadonlyArray<SiteCar>;
  /** Slug do site, usado pra construir o href de cada card. */
  slug: string;
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const KM = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

/**
 * Grid de cards de carros (Phase 7 — issue #164).
 *
 * Server Component. Renderiza N cards em grid responsivo
 * (1-col mobile / 2-col md / 3-col lg). Cada card é um `<Link>` para
 * `/sites/<slug>/estoque/<car.slug>` com:
 *   - Thumbnail via `next/image fill unoptimized` (CDN não whitelisted).
 *   - Brand + Model + Year (h3).
 *   - KM formatado (`pt-BR` Intl).
 *   - Price formatado em BRL (`Intl.NumberFormat`) — fallback "Sob consulta"
 *     quando `price === null`.
 *   - Badge "Destaque" quando `featured === true`.
 *
 * `data-testid="car-card-<slug>"` em cada card pra E2E.
 *
 * Ordenação **não acontece aqui** — fica no caller (`<StockSection>`).
 * Esse componente é puramente de apresentação.
 */
export function StockGrid({ cars, slug }: StockGridProps) {
  return (
    <ul
      data-testid="stock-grid"
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      {cars.map((car) => (
        <li key={car.slug}>
          <Link
            href={`/sites/${slug}/estoque/${car.slug}`}
            data-testid={`car-card-${car.slug}`}
            className="group block overflow-hidden rounded-3xl border border-foreground/10 bg-background transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-foreground/5">
              <Image
                src={car.thumbnail_url}
                alt={`${car.brand} ${car.model} ${car.year}`}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition duration-300 group-hover:scale-[1.02]"
                unoptimized
              />
              {car.featured && (
                <span
                  data-testid="car-card-featured-badge"
                  className="absolute left-3 top-3 inline-flex items-center rounded-full bg-foreground px-3 py-1 text-xs font-medium uppercase tracking-wider text-background"
                >
                  Destaque
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 p-5">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {car.brand} {car.model}{" "}
                <span className="text-foreground/60">{car.year}</span>
              </h2>
              <p className="text-sm text-foreground/60">
                {KM.format(car.km)} km · {car.transmission} · {car.fuel}
              </p>
              <p className="mt-2 text-xl font-bold text-foreground">
                {car.price === null ? "Sob consulta" : BRL.format(car.price)}
              </p>
              <span className="mt-3 inline-flex items-center text-sm font-medium text-foreground/80 group-hover:text-foreground">
                Ver detalhes →
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
