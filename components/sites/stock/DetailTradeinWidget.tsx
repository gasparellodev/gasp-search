import "server-only";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Widget cross-conversion `bg-muted` no detalhe do carro (Phase 7 /
 * Sprint 6 / #D3 — issue #228).
 *
 * Anatomy:
 *  - Card `bg-[var(--auto-muted)]` com padding generoso.
 *  - h2 "Use seu carro como entrada".
 *  - Body curto PT-BR convidando à avaliação.
 *  - CTA "AVALIAR" primary → `/sites/<slug>/anunciar?car_target_slug=<currentCarSlug>`.
 *
 * **`car_target_slug` querystring:** coordenado com a issue #231
 * (`/anunciar` O3). Quando #231 chegar, o form lê esse param e pré-popula
 * "Você está trocando pelo {brand} {model}". Hoje a rota existe e ignora
 * o param graciosamente — sem regressão.
 *
 * Server Component puro — sem `'use client'`.
 */
interface DetailTradeinWidgetProps {
  /** Slug do site (`SiteVariablesV2.business_slug`). */
  slug: string;
  /**
   * Slug do veículo atual renderizado em `/estoque/<carSlug>`.
   *
   * Vai pra querystring `?car_target_slug=...` na rota `/anunciar`.
   * `encodeURIComponent` aplicado defensivamente — apesar de
   * `SiteCar.slug` ser validado contra `/^[a-z0-9-]+$/`, o widget
   * pode ser usado com slugs externos no futuro.
   */
  currentCarSlug: string;
}

export function DetailTradeinWidget({
  slug,
  currentCarSlug,
}: DetailTradeinWidgetProps) {
  const href = `/sites/${slug}/anunciar?car_target_slug=${encodeURIComponent(currentCarSlug)}`;

  return (
    <section
      data-testid="detail-tradein-widget"
      aria-labelledby="detail-tradein-heading"
      className="mt-12 rounded-[var(--auto-radius-md,8px)] border border-[var(--auto-border,#e5e5e5)] bg-[var(--auto-muted,#f5f5f5)] p-6 md:p-10"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center md:gap-6">
        <h2
          id="detail-tradein-heading"
          className="as-h2 text-[var(--auto-foreground,#0a0a0a)]"
        >
          Use seu carro como entrada
        </h2>
        <p className="max-w-xl text-sm text-[var(--auto-muted-foreground,#737373)] md:text-base">
          Avaliamos seu veículo atual e descontamos do valor final. Envie fotos
          e dados em poucos minutos — a avaliação fica válida por 7 dias.
        </p>
        <Link
          href={href}
          data-testid="detail-tradein-cta"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--auto-foreground,#0a0a0a)] px-6 py-3 text-sm font-semibold text-[var(--auto-background,#ffffff)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-focus-ring,#0a0a0a)]"
        >
          AVALIAR
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
