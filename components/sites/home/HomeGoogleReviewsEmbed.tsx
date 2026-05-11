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
 * 3 placeholder reviews PT-BR genéricos (V1). Em V2, `// TODO V2:
 * fetch reviews reais via Google Places API`. Textos curtos, neutros e
 * positivos — não atribuíveis a clientes ou concorrentes reais.
 */
const PLACEHOLDER_REVIEWS: ReadonlyArray<{
  author: string;
  body: string;
  rating: number;
}> = [
  {
    author: "Cliente verificado",
    body: "Ótima experiência de compra. Equipe atenciosa e processo de financiamento rápido.",
    rating: 5,
  },
  {
    author: "Cliente verificado",
    body: "Carro entregue no prazo, com tudo combinado. Já indiquei pra família.",
    rating: 5,
  },
  {
    author: "Cliente verificado",
    body: "Estoque variado e preços justos. Recomendo a loja para quem quer seminovos.",
    rating: 5,
  },
];

/**
 * Google reviews embed V1 (Phase 7 / Sprint 4 / #H3 — issue #223).
 *
 * V1 hardcoded: big rating + count (lê props upstream propagados de
 * `lead_sites → leads`) + 3 placeholder reviews + caption + link "Ver
 * todas no Google" (apontando pro `/contato` por enquanto).
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
  // Fallback pareado: ambos rating+count válidos ou cai no fallback.
  const useRealData =
    typeof rating === "number" &&
    rating > 0 &&
    typeof reviewsCount === "number" &&
    reviewsCount > 0;

  const displayRating = useRealData && rating ? rating : 4.8;
  const displayCount = useRealData && reviewsCount ? reviewsCount : 87;
  const safePrimary = sanitizeHex(primary_color);

  return (
    <section
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

        <ul
          className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 md:gap-6"
          role="list"
        >
          {PLACEHOLDER_REVIEWS.map((review, i) => (
            <li
              key={`review-${i}`}
              className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-background p-5 md:p-6"
            >
              <div
                className="flex items-center gap-0.5"
                role="img"
                aria-label={`${review.rating} de 5 estrelas`}
              >
                {Array.from({ length: review.rating }).map((_, k) => (
                  <Star
                    key={k}
                    className="size-4"
                    style={{ color: safePrimary, fill: safePrimary }}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <p className="text-sm text-foreground/80 md:text-base">
                {review.body}
              </p>
              <p className="mt-auto text-xs text-foreground/55">
                — {review.author}
              </p>
            </li>
          ))}
        </ul>

        <footer className="mt-10 flex flex-col items-center gap-3 text-center md:mt-14">
          <p className="text-xs text-foreground/60 md:text-sm">
            Avaliações do Google Business Profile
          </p>
          <Link
            href="https://www.google.com/maps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-foreground underline underline-offset-4 hover:opacity-80"
          >
            Ver todas no Google
          </Link>
        </footer>
        {/* TODO V2: fetch reviews reais via Google Places API */}
      </div>
    </section>
  );
}
