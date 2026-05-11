import "server-only";

import Link from "next/link";

import type { SiteVariablesV2 } from "@/types/lead-site";

import { AICitableHero } from "../AICitableHero";

import {
  classifyCar,
  parseCategoriaParam,
  type CarCategorySlug,
} from "./car-categories";
import { StockFilter } from "./StockFilter";
import { StockGrid } from "./StockGrid";

interface StockSectionProps {
  variables: SiteVariablesV2;
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
          {/*
            AI passage-citable (#214). Imediatamente após <h1>, sempre
            visível mobile.
          */}
          <AICitableHero
            variables={{
              business_name: variables.business_name,
              address: variables.address,
              cars: variables.cars,
            }}
            page="estoque"
          />
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
            className="mx-auto flex max-w-md flex-col items-center gap-6 px-6 py-20 text-center"
          >
            {/* Conceito visual: estrada para o horizonte (Identidade #4).
                Linhas paralelas convergindo + dashes centrais em accent-primary
                + linha do horizonte. SVG inline, w-32 h-32, opacity 60%. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 100 100"
              className="size-32 opacity-60"
            >
              {/* Horizonte (linha sutil) */}
              <line
                x1="20"
                y1="40"
                x2="80"
                y2="40"
                stroke="currentColor"
                strokeWidth="0.6"
                opacity="0.3"
              />
              {/* Estrada — duas linhas convergindo do bottom ao ponto de fuga (50,40) */}
              <line
                x1="10"
                y1="95"
                x2="46"
                y2="40"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="90"
                y1="95"
                x2="54"
                y2="40"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {/* Faixas centrais tracejadas em accent-primary — perspectiva (mais altas/largas embaixo) */}
              <rect x="48" y="86" width="4" height="6" rx="0.5" style={{ fill: "var(--site-primary)" }} />
              <rect x="48.7" y="70" width="2.6" height="4" rx="0.4" style={{ fill: "var(--site-primary)" }} />
              <rect x="49.2" y="56" width="1.6" height="2.5" rx="0.3" style={{ fill: "var(--site-primary)" }} />
              <rect x="49.5" y="46" width="1" height="1.5" rx="0.2" style={{ fill: "var(--site-primary)" }} />
            </svg>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Nenhum carro encontrado
              </h2>
              <p className="text-base text-foreground/70 md:text-lg">
                Tente remover algum filtro ou veja o estoque completo.
              </p>
            </div>
            <Link
              href={`/sites/${slug}/estoque`}
              style={{
                backgroundColor: "var(--site-primary)",
                color: "var(--site-text-on-primary)",
              }}
              className="inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-medium transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
            >
              Ver estoque completo
            </Link>
          </div>
        ) : (
          <StockGrid cars={sorted} slug={slug} />
        )}
      </div>
    </section>
  );
}
