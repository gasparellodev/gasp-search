import "server-only";

import { BadgeCheck, Building2, ShieldCheck, Star, Users } from "lucide-react";

interface HomeTrustStripProps {
  /**
   * Anos no mercado (props explícitas — PO refinement #221). Regras:
   *   - `undefined`/`null`/`0` → "Mais de 10 anos"
   *   - `1` → "1 ano no mercado"
   *   - `≥ 2` → "${N} anos no mercado"
   */
  yearsInMarket?: number | null;
  /**
   * Rating Google da concessionária (props explícitas, lidas de
   * `lead.rating` no caller `SitePage`). Quando combinado com
   * `reviewsCount` válido (> 0), renderiza `${rating.toFixed(1)}★ ${N} reviews`.
   * Em qualquer ausência ou `reviewsCount <= 0`, cai no trust pillar
   * genérico "Atendimento personalizado" (Wave A3 — D-12: zero
   * placeholders factuais para não quebrar confiança do lead).
   */
  rating?: number | null;
  /** Contagem de reviews Google (lida de `lead.reviews_count`). */
  reviewsCount?: number | null;
}

function buildYearsLabel(yearsInMarket: number | null | undefined): string {
  if (yearsInMarket === undefined || yearsInMarket === null || yearsInMarket === 0) {
    return "Mais de 10 anos";
  }
  if (yearsInMarket === 1) return "1 ano no mercado";
  return `${yearsInMarket} anos no mercado`;
}

function hasValidRating(
  rating: number | null | undefined,
  reviewsCount: number | null | undefined,
): rating is number {
  return (
    rating !== null &&
    rating !== undefined &&
    reviewsCount !== null &&
    reviewsCount !== undefined &&
    reviewsCount > 0
  );
}

/**
 * Trust strip full-bleed (Phase 7 / Sprint 4 / #H1 — issue #221).
 *
 * Server Component. Strip horizontal 80px de altura com 4 colunas:
 *   1. Garantia incluída (estático).
 *   2. Vistoria 100 pontos (estático).
 *   3. Anos no mercado (dinâmico — `yearsInMarket` prop).
 *   4. Rating + reviews Google (dinâmico — `rating`/`reviewsCount` props).
 *
 * **Full-bleed**: aplicado via `relative left-1/2 -translate-x-1/2 w-screen`
 * para sair do max-width do main container e ocupar 100vw. Permite o
 * background contraste com o conteúdo restante da Home.
 *
 * **Props explícitas** — `SitePage` (caller) lê `lead.rating` /
 * `lead.reviews_count` (de `types/database.ts`) e propaga aqui sem
 * estender `SiteVariables` (decisão PO #221: evita migration). Em
 * leads sem dados Google Maps a strip cai no fallback gracioso.
 */
export function HomeTrustStrip({
  yearsInMarket,
  rating,
  reviewsCount,
}: HomeTrustStripProps = {}) {
  const yearsLabel = buildYearsLabel(yearsInMarket);
  const showRating = hasValidRating(rating, reviewsCount);
  const ratingLabel = showRating
    ? `${rating.toFixed(1)}★ ${reviewsCount} reviews`
    : null;

  return (
    <section
      role="region"
      aria-label="Diferenciais"
      data-testid="home-trust-strip"
      className="relative left-1/2 -translate-x-1/2 w-screen border-y border-foreground/15 bg-[color-mix(in_srgb,var(--site-primary)_10%,white)] dark:bg-[color-mix(in_srgb,var(--site-primary)_14%,#0a0a0a)]"
    >
      <ul className="mx-auto grid h-20 max-w-7xl grid-cols-2 items-center gap-3 px-4 text-foreground/95 md:grid-cols-4 md:gap-6 md:px-8">
        <li className="flex items-center gap-2.5">
          <ShieldCheck aria-hidden className="size-5 shrink-0 text-foreground/75" />
          <span className="truncate text-sm font-medium md:text-base">
            Garantia incluída
          </span>
        </li>
        <li className="flex items-center gap-2.5">
          <BadgeCheck aria-hidden className="size-5 shrink-0 text-foreground/75" />
          <span className="truncate text-sm font-medium md:text-base">
            Vistoria 100 pontos
          </span>
        </li>
        <li className="flex items-center gap-2.5">
          <Building2 aria-hidden className="size-5 shrink-0 text-foreground/75" />
          <span className="truncate text-sm font-medium md:text-base">
            {yearsLabel}
          </span>
        </li>
        {showRating ? (
          <li className="flex items-center gap-2.5">
            <Star
              aria-hidden
              className="size-5 shrink-0 fill-yellow-400 text-yellow-400"
            />
            <span className="truncate text-sm font-medium md:text-base">
              {ratingLabel}
            </span>
          </li>
        ) : (
          <li className="flex items-center gap-2.5">
            <Users aria-hidden className="size-5 shrink-0 text-foreground/75" />
            <span className="truncate text-sm font-medium md:text-base">
              Atendimento personalizado
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}
