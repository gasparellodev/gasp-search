import "server-only";

import { Star } from "lucide-react";

import { sanitizeHex } from "@/lib/sites/sanitize";
import type { Testimonial } from "@/types/lead-site";

interface HomeTestimonialsGridProps {
  /**
   * Testimonials do `variables.testimonials[]` v2 (até 8). Componente
   * usa `slice(0, 3)` pra grid de 3 cards. Quando vazio/undefined,
   * renderiza 3 fallback hardcoded neutros (PO decision — NÃO usar
   * "JBL" ou nomes reais de outras lojas).
   */
  testimonials?: readonly Testimonial[] | null;
  /** Hex sanitizado upstream do `<SitePage>`; usado no border do card destacado. */
  primary_color: string;
}

/**
 * Fallback hardcoded PT-BR neutro (PO refinement #223). 3 nomes
 * genéricos com primeira inicial do sobrenome — não atribuíveis a
 * concorrentes ou clientes reais. Esses textos são canônicos —
 * mudanças requerem PO sign-off.
 */
const FALLBACK_TESTIMONIALS: readonly Testimonial[] = [
  {
    author_name: "Maria S.",
    author_avatar_url: null,
    rating: 5,
    text: "Atendimento excelente, entregaram o carro no prazo combinado e ainda fizeram brindes.",
    source: "manual",
  },
  {
    author_name: "João P.",
    author_avatar_url: null,
    rating: 5,
    text: "Financiei pela própria loja, taxas justas e processo super rápido.",
    source: "manual",
  },
  {
    author_name: "Ana C.",
    author_avatar_url: null,
    rating: 5,
    text: "Carro veio exatamente como anunciado. Recomendo!",
    source: "manual",
  },
];

/** Cidades fallback alinhadas com os autores fallback (PO decision). */
const FALLBACK_CITIES: Record<string, string> = {
  "Maria S.": "São Paulo/SP",
  "João P.": "Curitiba/PR",
  "Ana C.": "Belo Horizonte/MG",
};

/**
 * Testimonials grid — 3 cards (Phase 7 / Sprint 4 / #H3 — issue #223).
 *
 * Lê `variables.testimonials[]` v2; quando ausente/vazio, cai em
 * `FALLBACK_TESTIMONIALS` (3 nomes neutros PT-BR). Avatar via monogram
 * inline SVG (data URI) — reuso pattern de `lib/sites/brand-assets.ts:
 * buildMonogramLogo`, mas inline pra evitar Vercel Blob round-trip.
 *
 * Server Component. Sem state — render estático.
 */
export function HomeTestimonialsGrid({
  testimonials,
  primary_color,
}: HomeTestimonialsGridProps) {
  const safePrimary = sanitizeHex(primary_color);

  const items = (testimonials && testimonials.length > 0
    ? testimonials
    : FALLBACK_TESTIMONIALS
  ).slice(0, 3);

  return (
    <section
      data-testid="home-testimonials-grid"
      aria-label="Avaliações de clientes"
      className="w-full bg-background py-16 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <header className="mb-10 flex flex-col gap-3 text-center md:mb-14">
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/60"
            aria-hidden="true"
          >
            O que nossos clientes dizem
          </p>
          <h2 className="as-h2 text-foreground">
            Avaliações reais de quem comprou conosco
          </h2>
        </header>

        <ul
          className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8"
          role="list"
        >
          {items.map((t) => {
            const city = FALLBACK_CITIES[t.author_name];
            return (
              <li
                key={`${t.author_name}-${t.text.slice(0, 16)}`}
                className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-6 md:p-8"
              >
                <div
                  className="flex items-center gap-1"
                  role="img"
                  aria-label={`${t.rating} de 5 estrelas`}
                >
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="size-4"
                      style={{ color: safePrimary, fill: safePrimary }}
                      aria-hidden="true"
                    />
                  ))}
                </div>

                <blockquote className="text-base text-foreground/85 md:text-lg">
                  &ldquo;{t.text}&rdquo;
                </blockquote>

                <footer className="mt-2 flex items-center gap-3">
                  <Monogram name={t.author_name} primaryColor={safePrimary} />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">
                      {t.author_name}
                    </span>
                    {city && (
                      <span className="text-xs text-foreground/60">
                        {city}
                      </span>
                    )}
                  </div>
                </footer>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/**
 * Inline monogram SVG (1ª letra do nome). Avoid Vercel Blob round-trip —
 * pure data URI. Reuso conceito de `buildMonogramLogo` em brand-assets.
 */
function Monogram({
  name,
  primaryColor,
}: {
  name: string;
  primaryColor: string;
}) {
  const letter = name.trim().charAt(0).toUpperCase() || "•";
  return (
    <div
      className="flex size-10 shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: primaryColor }}
      aria-hidden="true"
    >
      <span className="text-sm font-semibold" style={{ color: "#FFFFFF" }}>
        {letter}
      </span>
    </div>
  );
}
