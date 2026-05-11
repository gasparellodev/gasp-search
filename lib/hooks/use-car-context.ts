"use client";

import { useMemo } from "react";

import {
  DEFAULT_CARD_DOWN_PCT,
  DEFAULT_CARD_INSTALLMENT_MONTHS,
  calculateInstallment,
  formatBRL,
} from "@/lib/finance";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import type { SiteCar } from "@/types/lead-site";

export interface InitialCarContext {
  businessName: string;
  whatsapp: string;
  car: SiteCar;
}

export interface CarContext {
  vehicleLabel: string;
  priceLabel: string;
  installmentLabel: string | null;
  whatsappHref: string;
}

export function useCarContext(
  slug: string,
  carSlug: string,
  initialContext: InitialCarContext,
): CarContext {
  return useMemo(() => {
    const { car } = initialContext;
    if (car.slug !== carSlug) {
      throw new Error("useCarContext: carSlug mismatch");
    }

    const vehicleLabel = `${car.brand} ${car.model} ${car.year}`;
    const priceLabel = car.price === null ? "Sob consulta" : formatBRL(car.price);
    const installmentLabel =
      car.price === null
        ? null
        : `${DEFAULT_CARD_INSTALLMENT_MONTHS}x de ${formatBRL(
            calculateInstallment({
              price: car.price,
              downPaymentPct: DEFAULT_CARD_DOWN_PCT,
              months: DEFAULT_CARD_INSTALLMENT_MONTHS,
            }).installment,
          )}`;

    const whatsappHref = buildWhatsAppLink({
      template: "vehicle",
      phone: initialContext.whatsapp,
      businessName: initialContext.businessName,
      siteSlug: slug,
      component: "floating-cta",
      vehicle: {
        brand: car.brand,
        model: car.model,
        year: car.year,
        price: car.price,
        carSlug: car.slug,
      },
    });

    return {
      vehicleLabel,
      priceLabel,
      installmentLabel,
      whatsappHref,
    };
  }, [carSlug, initialContext, slug]);
}
