import "server-only";

import Link from "next/link";

import type { SiteVariables } from "@/types/lead-site";

import {
  classifyCar,
  parseCategoriaParam,
  type CarCategorySlug,
} from "./car-categories";
import { StockFilter } from "./StockFilter";
import { StockGrid } from "./StockGrid";

interface StockSectionProps {
  variables: SiteVariables;
  /** Valor cru de `?categoria=` (CSV) — pode ser `null`/`undefined`. */
  categoriaFilter: string | null | undefined;
  slug: string;
}

/**
 * Section principal da rota `/sites/[slug]/estoque` (Phase 7 — issue #164).
 *
 * Server Component. Responsabilidades:
 *   1. **Parse defensivo** do `?categoria=` (CSV → `Set<CarCategorySlug>`).
 *      Tokens inválidos viram no-op (lista todos).
 *   2. **Filtra** `variables.cars[]` pela classificação heurística
 *      (`classifyCar`). Carros com categoria `null` ficam **fora** quando
 *      há filtro ativo (UX previsível: "filtrar por SUV" não inclui
 *      carros que o classificador não conhece).
 *   3. **Ordena** featured-first (immutable via `.toSorted`).
 *   4. **Empty state**: 0 matches → mensagem PT-BR + link "Ver todos"
 *      apontando pra `/sites/<slug>/estoque` (sem `?categoria`).
 *   5. Renderiza `<StockFilter>` (client) + `<StockGrid>` (server).
 *
 * Per spec §13: zero `dangerouslySetInnerHTML`. Cores não são consumidas
 * aqui — `<SitePage>` parent já injeta as CSS vars.
 */
export function StockSection({
  variables,
  categoriaFilter,
  slug,
}: StockSectionProps) {
  const active = parseCategoriaParam(categoriaFilter) ?? new Set<CarCategorySlug>();

  // Filtragem: quando há filtro ativo, mantém só os carros cuja categoria
  // (heurística) está no Set. Sem filtro, mantém todos.
  const filtered =
    active.size === 0
      ? variables.cars
      : variables.cars.filter((car) => {
          const cat = classifyCar(car);
          return cat !== null && active.has(cat);
        });

  // Featured-first, immutable. `.toSorted` (ES2023) mantém ordem dos
  // não-featured estável.
  const sorted = filtered.toSorted(
    (a, b) => Number(b.featured) - Number(a.featured),
  );

  return (
    <section data-testid="stock-section" className="w-full bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-20">
        <header className="mb-8 flex flex-col gap-4 md:mb-10">
          <h1
            className="font-bold leading-[1.05] tracking-tight text-foreground"
            style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)" }}
          >
            Estoque
          </h1>
          <p className="text-base text-foreground/70 md:text-lg">
            Encontre o carro ideal — selecione uma categoria pra filtrar.
          </p>
        </header>

        <div className="mb-8 md:mb-10">
          <StockFilter slug={slug} active={active} />
        </div>

        {sorted.length === 0 ? (
          <div
            data-testid="stock-empty"
            className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-foreground/20 px-6 py-16 text-center"
          >
            <p className="text-base text-foreground/70 md:text-lg">
              Nenhum veículo nessa categoria no momento.
            </p>
            <Link
              href={`/sites/${slug}/estoque`}
              className="inline-flex items-center rounded-full border border-foreground/20 px-5 py-2 text-sm font-medium text-foreground transition hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
            >
              Ver todos os veículos
            </Link>
          </div>
        ) : (
          <StockGrid cars={sorted} slug={slug} />
        )}
      </div>
    </section>
  );
}
