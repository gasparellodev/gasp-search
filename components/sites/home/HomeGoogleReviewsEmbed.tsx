import "server-only";

import Link from "next/link";
import { Star } from "lucide-react";

import { sanitizeHex } from "@/lib/sites/sanitize";

interface HomeGoogleReviewsEmbedProps {
  /**
   * Rating Google do lead — propagado upstream pelo `<SitePage>` (lê
   * `site.lead_rating`). Fallback `4.8` quando null (PO refinement —
   * mesmo pattern do `<HomeTrustStrip>` #221).
   */
  rating: number | null;
  /** Total de reviews Google — fallback `87` quando null. */
  reviewsCount: number | null;
  /** Hex sanitizado upstream do `<SitePage>`; usado nas stars. */
  primary_color: string;
}

/**
 * Google reviews embed (Phase 7 / Sprint 4 / #H3 — issue #223;
 * Wave A3 — D-12 honesty pass).
 *
 * Renderiza big rating + count + CTA primary para o GBP do lead.
 * **Só renderiza quando rating > 0 E reviewsCount >= 3** — abaixo
 * disso retorna `null` (sem fake "4.8★ 87 reviews" + sem 3 textos
 * placeholders genéricos que quebravam confiança quando lead
 * comparava com seu próprio GBP).
 *
 * **V2 follow-up:** fetch reviews reais via Google Places API + cache
 * 24h em ISR. Por isso o componente é Server-only — facilita migração.
 *
 * Server Component. Sem state — render estático.
 */
export function HomeGoogleReviewsEmbed({
  rating,
  reviewsCount,
  primary_color,
}: HomeGoogleReviewsEmbedProps) {
  // Wave A3 (D-12): só renderiza com dados reais — sem placeholders
  // factuais ("4.8★ 87 reviews" + 3 textos genéricos) que quebravam a
  // confiança quando o lead comparava com o GBP real.
  const hasRealData =
    typeof rating === "number" &&
    rating > 0 &&
    typeof reviewsCount === "number" &&
    reviewsCount >= 3;

  if (!hasRealData) {
    return null;
  }

  const displayRating = rating;
  const displayCount = reviewsCount;
  const safePrimary = sanitizeHex(primary_color);

  return (
    <section
      data-reveal
      data-testid="home-google-reviews-embed"
      aria-label="Avaliações no Google"
      className="w-full bg-foreground/[0.02] py-16 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <header className="mb-10 flex flex-col items-center gap-4 text-center md:mb-14">
          <div
            className="flex items-baseline gap-3"
            role="img"
            aria-label={`Nota ${displayRating.toFixed(1)} de 5 baseado em ${displayCount} avaliações`}
          >
            <span
              className="font-bold leading-none tracking-tight text-foreground tabular-nums"
              style={{ fontSize: "clamp(3rem, 7vw, 5rem)" }}
            >
              {displayRating.toFixed(1)}
            </span>
            <div
              className="flex items-center gap-0.5"
              aria-hidden="true"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="size-6 md:size-7"
                  style={{ color: safePrimary, fill: safePrimary }}
                />
              ))}
            </div>
          </div>
          <p className="text-sm text-foreground/70 md:text-base">
            <span className="font-semibold text-foreground">
              {displayCount.toLocaleString("pt-BR")} avaliações
            </span>{" "}
            no Google
          </p>
        </header>

        <footer className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-foreground/70 md:text-base">
            Avaliações verificadas no Google Business Profile
          </p>
          <Link
            href="https://www.google.com/maps"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--site-primary)] px-6 py-3 text-sm font-semibold text-[var(--site-text-on-primary)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-primary)]/60 md:text-base"
          >
            Ler todas as avaliações no Google
          </Link>
        </footer>
        {/* TODO V2: fetch reviews reais via Google Places API */}
      </div>
    </section>
  );
}
