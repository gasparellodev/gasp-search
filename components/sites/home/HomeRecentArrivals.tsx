import "server-only";

import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";

import { CarCard } from "@/components/sites/cars/CarCard";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import type { SiteCar } from "@/types/lead-site";

interface HomeRecentArrivalsProps {
  /**
   * Carros do estoque. Renderiza até 8 cards (`.slice(0, 8)`). Schema
   * garante min 4 em V2, mas componente defende `cars.length === 0` em
   * runtime (lead com payload mutilado / migração futura).
   *
   * **Decisão de fonte (PO spec ambiguity):** body da issue cita
   * `variables.recent_sales`, mas `recent_sales` no schema só tem 3
   * entries com `{car_name, image_url}` — incompatível com anatomia
   * full do `<CarCard>` (precisa de `slug, brand, model, year, km,
   * price, transmission, fuel, color, thumbnail_url, ...`). `cars`
   * é a única fonte SiteCar-compatible. PO refinement comment #10 deixa
   * "definir `variables.cars.slice(0, 8)` ou `variables.recent_sales.
   * slice(0, 8)`" — usamos `cars` por semantic + compat.
   */
  cars: ReadonlyArray<SiteCar>;
  /** Slug do site (link interno `/sites/<slug>/estoque`). */
  siteSlug: string;
  /** Telefone E.164 BR sem `+` (propagado a `<CarCard>`). */
  whatsappPhone: string;
  /** Nome do negócio (mensagem do WhatsApp / empty state). */
  businessName: string;
}

const MAX_CARDS = 8;

/**
 * Bloco "Recém-chegados" da Home (Phase 7 / Sprint 4 / #H2 — issue #222).
 *
 * Server Component. Substitui o legacy `<HomeRecentSales>` (3 cards estáticos
 * com car_name + foto). Agora reusa `<CarCard>` (Sprint 0 / #F4) para coerência
 * visual com Estoque/Detalhe.
 *
 * Layout:
 *   - Mobile: scroll horizontal snap (`snap-x snap-mandatory`).
 *   - Desktop ≥ md: grid 4 cols × até 2 rows (8 cards total).
 *   - Header `<h2>` + CTA "Ver estoque completo" no canto direito.
 *
 * **Empty state**: `cars.length === 0` → trust signal copy + WhatsApp CTA
 * template `general` (não seção em branco — AC §empty state issue #222).
 */
export function HomeRecentArrivals({
  cars,
  siteSlug,
  whatsappPhone,
  businessName,
}: HomeRecentArrivalsProps) {
  const visible = cars.slice(0, MAX_CARDS);
  const isEmpty = visible.length === 0;

  return (
    <section
      data-testid="home-recent-arrivals"
      className="w-full bg-background"
      aria-labelledby="home-recent-arrivals-title"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
        <div className="mb-8 flex items-end justify-between gap-4 md:mb-10">
          <h2
            id="home-recent-arrivals-title"
            className="as-h2 text-foreground"
          >
            Recém-chegados
          </h2>
          {!isEmpty ? (
            <Link
              data-testid="home-recent-arrivals-cta"
              href={`/sites/${siteSlug}/estoque`}
              className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
            >
              Ver estoque completo
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          ) : null}
        </div>

        {isEmpty ? (
          <EmptyState
            siteSlug={siteSlug}
            whatsappPhone={whatsappPhone}
            businessName={businessName}
          />
        ) : (
          <ul
            data-testid="home-recent-arrivals-grid"
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:gap-6 md:overflow-visible md:pb-0"
          >
            {visible.map((car) => (
              <li
                key={car.slug}
                className="w-[80%] shrink-0 snap-start md:w-auto"
              >
                <CarCard
                  car={car}
                  siteSlug={siteSlug}
                  whatsappPhone={whatsappPhone}
                  businessName={businessName}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface EmptyStateProps {
  siteSlug: string;
  whatsappPhone: string;
  businessName: string;
}

function EmptyState({
  siteSlug,
  whatsappPhone,
  businessName,
}: EmptyStateProps) {
  const whatsappHref = buildWhatsAppLink({
    phone: whatsappPhone,
    businessName,
    siteSlug,
    component: "home-cta",
    template: "general",
  });

  return (
    <div
      data-testid="home-recent-arrivals-empty"
      className="flex flex-col items-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.02] px-6 py-10 text-center md:py-14"
    >
      <ShieldCheck
        aria-hidden
        className="size-10 text-foreground/60 md:size-12"
      />
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-foreground md:text-lg">
          Novos carros chegando em breve
        </p>
        <p className="max-w-md text-sm text-foreground/70">
          Estamos preparando o próximo lote — todos passam por inspeção rigorosa.
          Fale com a {businessName} pelo WhatsApp para saber o que está chegando.
        </p>
      </div>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full bg-[var(--auto-whatsapp,#25d366)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--auto-whatsapp-hover,#1fb855)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-whatsapp,#25d366)]"
      >
        Falar no WhatsApp
      </a>
    </div>
  );
}
