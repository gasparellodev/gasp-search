import "server-only";

import Link from "next/link";

import { CarCard } from "@/components/sites/cars/CarCard";
import { findSimilarCars } from "@/lib/sites/find-similar-cars";
import type { SiteCar } from "@/types/lead-site";

/**
 * Section "Veículos similares" no detalhe do carro (Phase 7 / Sprint 6 /
 * #D3 — issue #228).
 *
 * Algorithm em `lib/sites/find-similar-cars.ts`. Anatomy:
 *
 *  - Sub-bloco "Veículos similares" (h2) — matches fortes (similar).
 *  - Sub-bloco "Você também pode gostar" (h3 menor, badge-like) —
 *    matches fracos (fallback top-priced quando similar < 4).
 *  - CTA "Ver estoque completo" quando `total < limit` (estoque pequeno
 *    ou poucos matches).
 *  - `null` quando o pool inteiro está vazio (defensivo, evita seção
 *    fantasma).
 *
 * Mobile: scroll horizontal `snap-x snap-mandatory` (per AC #228).
 * Desktop: grid de 4 colunas sem scroll.
 *
 * Reusa `<CarCard>` shared (issue #201) — mesmo card que o `/estoque`
 * usa, mantendo identidade visual consistente.
 *
 * Server Component puro.
 */
interface DetailSimilarVehiclesProps {
  /** Carro atual renderizado em `/estoque/<carSlug>`. */
  current: SiteCar;
  /** Estoque completo (`SiteVariablesV2.cars`). */
  cars: SiteCar[];
  /** Slug do site (para links internos). */
  slug: string;
  /** Telefone WhatsApp E.164 sem `+` (validado upstream). */
  whatsappPhone: string;
  /** Nome do negócio (para mensagem WhatsApp). */
  businessName: string;
  /** Máximo de cards exibidos. Default 4 conforme AC #228. */
  limit?: number;
}

const SCROLLER_CLASSES =
  "flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 pb-2 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:scroll-px-0 md:pb-0 lg:grid-cols-4";

const CARD_WRAPPER_CLASSES = "w-[80%] shrink-0 snap-start md:w-auto";

function CarGrid({
  cars,
  testId,
  slug,
  whatsappPhone,
  businessName,
}: {
  cars: SiteCar[];
  testId: string;
  slug: string;
  whatsappPhone: string;
  businessName: string;
}) {
  return (
    <div data-testid={testId} className={SCROLLER_CLASSES}>
      {cars.map((car) => (
        <div key={car.slug} className={CARD_WRAPPER_CLASSES}>
          <CarCard
            car={car}
            siteSlug={slug}
            whatsappPhone={whatsappPhone}
            businessName={businessName}
          />
        </div>
      ))}
    </div>
  );
}

export function DetailSimilarVehicles({
  current,
  cars,
  slug,
  whatsappPhone,
  businessName,
  limit = 4,
}: DetailSimilarVehiclesProps) {
  const { similar, fallback } = findSimilarCars(cars, current, limit);
  const total = similar.length + fallback.length;

  if (total === 0) {
    // Pool vazio (só o atual). Não renderiza section fantasma.
    return null;
  }

  const showStockCta = total < limit;

  return (
    <section
      data-testid="detail-similar-vehicles"
      aria-labelledby="detail-similar-heading"
      className="mt-16"
    >
      <div className="mb-6 flex flex-col gap-1 md:mb-8">
        <h2
          id="detail-similar-heading"
          className="as-h2 text-[var(--auto-foreground,#0a0a0a)]"
        >
          Veículos similares
        </h2>
        <p className="text-sm text-[var(--auto-muted-foreground,#737373)]">
          Outras opções da nossa loja na mesma faixa.
        </p>
      </div>

      {similar.length > 0 ? (
        <CarGrid
          cars={similar}
          testId="detail-similar-scroller"
          slug={slug}
          whatsappPhone={whatsappPhone}
          businessName={businessName}
        />
      ) : null}

      {fallback.length > 0 ? (
        <div className="mt-10">
          <h3
            className="mb-4 font-[family-name:var(--auto-font-display,inherit)] text-lg font-semibold text-[var(--auto-foreground,#0a0a0a)] md:text-xl"
            data-testid="detail-similar-fallback-heading"
          >
            Você também pode gostar
          </h3>
          <CarGrid
            cars={fallback}
            testId="detail-similar-fallback-scroller"
            slug={slug}
            whatsappPhone={whatsappPhone}
            businessName={businessName}
          />
        </div>
      ) : null}

      {showStockCta ? (
        <div className="mt-8 flex justify-center">
          <Link
            href={`/sites/${slug}/estoque`}
            data-testid="detail-similar-stock-cta"
            className="inline-flex items-center justify-center rounded-full border border-[var(--auto-border,#e5e5e5)] bg-[var(--auto-surface,#ffffff)] px-6 py-3 text-sm font-medium text-[var(--auto-foreground,#0a0a0a)] transition-colors hover:bg-[var(--auto-muted,#f5f5f5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-focus-ring,#0a0a0a)]"
          >
            Ver estoque completo
          </Link>
        </div>
      ) : null}
    </section>
  );
}
