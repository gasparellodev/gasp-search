import "server-only";

import {
  calculateInstallment,
  DEFAULT_CARD_DOWN_PCT,
  DEFAULT_CARD_INSTALLMENT_MONTHS,
  formatBRL,
} from "@/lib/finance";
import { cn } from "@/lib/utils";
import type { SiteCar, SiteVariablesV2 } from "@/types/lead-site";

import { DetailCtaStack } from "./DetailCtaStack";
import { DetailFinancingCalcInline } from "./DetailFinancingCalcInline";

type DetailPriceVariables = Pick<
  SiteVariablesV2,
  "business_name" | "business_slug" | "whatsapp"
>;

export interface DetailPriceBlockProps {
  variables: DetailPriceVariables;
  car: SiteCar;
}

function isCarSold(car: SiteCar): boolean {
  return car.available === false || car.status === "sold";
}

/**
 * Coluna lateral do detalhe: preço sticky, parcela, calculadora, selos de
 * confiança e stack de CTAs (Phase 7 / D2 — issue #227).
 */
export function DetailPriceBlock({ variables, car }: DetailPriceBlockProps) {
  const sold = isCarSold(car);
  const hasPrice = car.price !== null && car.price > 0;

  const installmentLine =
    hasPrice && !sold
      ? `${DEFAULT_CARD_INSTALLMENT_MONTHS}x de ${formatBRL(
          calculateInstallment({
            price: car.price!,
            downPaymentPct: DEFAULT_CARD_DOWN_PCT,
            months: DEFAULT_CARD_INSTALLMENT_MONTHS,
          }).installment,
        )}`
      : null;

  return (
    <div
      data-testid="detail-price-block"
      className={cn(
        "flex flex-col gap-5 rounded-2xl border border-foreground/10 bg-background p-5 lg:sticky lg:top-24 lg:z-[var(--z-sticky-sidebar,30)]",
      )}
    >
      {sold ? (
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-destructive">
          VENDIDO
        </p>
      ) : null}

      {hasPrice ? (
        <p
          data-testid="detail-price-display"
          className="text-3xl font-bold text-foreground md:text-4xl"
        >
          {formatBRL(car.price!)}
        </p>
      ) : (
        <p
          data-testid="detail-price-consult"
          className="text-2xl font-semibold text-foreground"
        >
          Preço sob consulta
        </p>
      )}

      {installmentLine ? (
        <p
          data-testid="detail-price-installment"
          className="text-sm text-foreground/70"
        >
          {installmentLine}
        </p>
      ) : null}

      {hasPrice && !sold ? (
        <DetailFinancingCalcInline
          price={car.price!}
          brand={car.brand}
          model={car.model}
          whatsappPhone={variables.whatsapp}
          businessName={variables.business_name}
          siteSlug={variables.business_slug}
        />
      ) : null}

      <ul
        data-testid="detail-trust-badges"
        className="flex flex-col gap-2 text-sm text-foreground/80"
      >
        <li className="flex items-center gap-2">
          <span className="text-foreground">✓</span> Garantia 1 ano
        </li>
        <li className="flex items-center gap-2">
          <span className="text-foreground">✓</span> Vistoria completa
        </li>
        <li className="flex items-center gap-2">
          <span className="text-foreground">✓</span> IPVA pago
        </li>
        <li className="flex items-center gap-2">
          <span className="text-foreground">✓</span> Documento OK
        </li>
      </ul>

      <DetailCtaStack
        car={car}
        whatsappPhone={variables.whatsapp}
        businessName={variables.business_name}
        siteSlug={variables.business_slug}
        unavailable={sold}
      />
    </div>
  );
}
