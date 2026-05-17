import { buildWhatsAppLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import type { SiteCar } from "@/types/lead-site";

export interface DetailCtaStackProps {
  car: SiteCar;
  whatsappPhone: string;
  businessName: string;
  siteSlug: string;
  /** Quando true, CTAs ficam desabilitados (ex.: veículo vendido). */
  unavailable?: boolean;
}

const ctaClass =
  "inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40";

/**
 * Par de CTAs full-width no detalhe do veículo (Phase 7 / D2).
 * Ambos usam template WhatsApp `vehicle` com `utm_content` distinto;
 * o texto da mensagem é idêntico (mesmo interesse no carro).
 */
export function DetailCtaStack({
  car,
  whatsappPhone,
  businessName,
  siteSlug,
  unavailable = false,
}: DetailCtaStackProps) {
  const vehicle = {
    brand: car.brand,
    model: car.model,
    year: car.year,
    price: car.price,
    carSlug: car.slug,
  };

  const hrefPrimary = buildWhatsAppLink({
    template: "vehicle",
    phone: whatsappPhone,
    businessName,
    siteSlug,
    component: "detail-cta-primary",
    vehicle,
  });

  const hrefSecondary = buildWhatsAppLink({
    template: "vehicle",
    phone: whatsappPhone,
    businessName,
    siteSlug,
    component: "detail-cta-secondary",
    vehicle,
  });

  if (unavailable) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled
          title="Veja carros similares"
          data-testid="detail-cta-primary"
          className={cn(
            ctaClass,
            "cursor-not-allowed bg-foreground/10 text-foreground/50",
          )}
        >
          Falar no WhatsApp
        </button>
        <button
          type="button"
          disabled
          title="Veja carros similares"
          data-testid="detail-cta-secondary"
          className={cn(
            ctaClass,
            "cursor-not-allowed border border-foreground/15 bg-background text-foreground/50",
          )}
        >
          Agendar test-drive
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <a
        href={hrefPrimary}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="detail-cta-primary"
        aria-label={`Falar no WhatsApp sobre ${car.brand} ${car.model} ${car.year}`}
        className={cn(
          ctaClass,
          "as-btn-lift bg-[var(--site-primary)] text-[var(--site-text-on-primary)] hover:opacity-90",
        )}
      >
        Falar no WhatsApp
      </a>
      <a
        href={hrefSecondary}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="detail-cta-secondary"
        className={cn(
          ctaClass,
          "border border-foreground/20 bg-background text-foreground hover:bg-foreground/[0.04]",
        )}
      >
        Agendar test-drive
      </a>
    </div>
  );
}
