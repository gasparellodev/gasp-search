import "server-only";

import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

import {
  calculateInstallment,
  DEFAULT_CARD_DOWN_PCT,
  DEFAULT_CARD_INSTALLMENT_MONTHS,
  formatBRL,
} from "@/lib/finance";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { formatKmBR } from "@/lib/whatsapp";
import type { SiteCar } from "@/types/lead-site";

interface CarCardProps {
  /** Car payload (v1 ou v2 — usa `thumbnail_url` canon, fallback `photos[0]` se ausente). */
  car: SiteCar;
  /** Slug do site (para link interno `/sites/<slug>/estoque/<car.slug>`). */
  siteSlug: string;
  /** Telefone E.164 BR sem `+` (validado upstream). */
  whatsappPhone: string;
  /** Nome do negócio (para mensagem do WhatsApp). */
  businessName: string;
}

/**
 * Card de veículo — shared building block (Sprint 0 / #F4 — issue #201).
 *
 * Server Component. Anatomia §card-vehicle do DESIGN.md:
 *   - `<article>` semantic com `aria-labelledby` apontando para h3.
 *   - Container `rounded-md` (var(--auto-radius-md) = 8px) + border 1px,
 *     **sem shadow no resting state** (DESIGN.md §Elevation: prefere lift via
 *     border + translate, não drop shadow).
 *   - Foto 4:3, `next/image` `fill unoptimized`, alt descritivo.
 *   - Info block padding 16px (`p-4` = var(--auto-space-md)).
 *   - Eyebrow `font-mono` uppercase tracking-wider (brand).
 *   - h3 `font-display` semibold (model + year).
 *   - Data inline `km · fuel · transmission`.
 *   - Price + installment ("Ou 48x de R$ X").
 *   - Hover lift `-translate-y-0.5` (250ms ease-out via tokens).
 *
 * Reusado em: `<StockGrid>` (E2), `<HomeFinancingWidget>` companion (H2),
 * `<CarDetail>` similar vehicles (D3).
 *
 * **Boundary fix**: WhatsApp link fica **fora** do `<Link>` interno
 * (footer separado) para evitar nested anchor — HTML inválido, screen
 * readers tropeçam.
 */
export function CarCard({
  car,
  siteSlug,
  whatsappPhone,
  businessName,
}: CarCardProps) {
  const headingId = `car-card-${car.slug}-title`;
  const photoSrc = car.thumbnail_url;

  const installmentResult =
    car.price !== null && car.price > 0
      ? calculateInstallment({
          price: car.price,
          downPaymentPct: DEFAULT_CARD_DOWN_PCT,
          months: DEFAULT_CARD_INSTALLMENT_MONTHS,
        })
      : null;

  const whatsappHref = buildWhatsAppLink({
    phone: whatsappPhone,
    businessName,
    siteSlug,
    component: "stock-card",
    template: "vehicle",
    vehicle: {
      brand: car.brand,
      model: car.model,
      year: car.year,
      price: car.price,
      carSlug: car.slug,
    },
  });

  return (
    <article
      data-testid={`car-card-${car.slug}`}
      aria-labelledby={headingId}
      className="group relative overflow-hidden rounded-[var(--auto-radius-md,8px)] border border-[var(--auto-border,#e5e5e5)] bg-[var(--auto-surface,#ffffff)] transition-transform duration-[var(--auto-duration-base,250ms)] ease-[var(--auto-ease-out,cubic-bezier(0.16,1,0.3,1))] hover:-translate-y-0.5"
    >
      <Link
        data-testid={`car-card-${car.slug}-link`}
        href={`/sites/${siteSlug}/estoque/${car.slug}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-focus-ring,#0a0a0a)]"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--auto-muted,#f5f5f5)]">
          <Image
            src={photoSrc}
            alt={`${car.brand} ${car.model} ${car.year}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            unoptimized
          />
        </div>

        <div className="flex flex-col gap-2 p-4">
          <p
            data-testid={`car-card-${car.slug}-eyebrow`}
            className="font-[family-name:var(--auto-font-mono,ui-monospace)] text-xs uppercase tracking-wider text-[var(--auto-muted-foreground,#737373)]"
          >
            {car.brand}
          </p>

          <h3
            id={headingId}
            className="font-[family-name:var(--auto-font-display,inherit)] text-lg font-semibold text-[var(--auto-foreground,#0a0a0a)]"
          >
            {car.model} {car.year}
          </h3>

          <p
            data-testid={`car-card-${car.slug}-data`}
            className="text-sm text-[var(--auto-muted-foreground,#737373)]"
          >
            {formatKmBR(car.km)} km · {car.fuel} · {car.transmission}
          </p>

          <p
            data-testid={`car-card-${car.slug}-price`}
            className="mt-2 font-[family-name:var(--auto-font-display,inherit)] text-xl font-semibold text-[var(--auto-foreground,#0a0a0a)]"
          >
            {car.price === null ? "Sob consulta" : formatBRL(car.price)}
          </p>

          {installmentResult !== null && (
            <p
              data-testid={`car-card-${car.slug}-installment`}
              className="text-xs text-[var(--auto-muted-foreground,#737373)]"
            >
              Ou {DEFAULT_CARD_INSTALLMENT_MONTHS}x de{" "}
              {formatBRL(installmentResult.installment)}
            </p>
          )}
        </div>
      </Link>

      <div className="border-t border-[var(--auto-border,#e5e5e5)] px-4 py-3">
        <a
          data-testid={`car-card-${car.slug}-whatsapp`}
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Falar no WhatsApp sobre ${car.brand} ${car.model} ${car.year}`}
          className="inline-flex items-center gap-2 text-xs font-medium text-[var(--auto-whatsapp,#25d366)] transition-colors hover:text-[var(--auto-whatsapp-hover,#1fb855)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-whatsapp,#25d366)]"
        >
          <MessageCircle aria-hidden className="h-4 w-4" />
          Falar no WhatsApp
        </a>
      </div>
    </article>
  );
}
