"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";

import {
  calculateInstallment,
  DEFAULT_MONTHLY_INTEREST,
  DISCLAIMER_TEXT,
  formatBRL,
} from "@/lib/finance";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export interface DetailFinancingCalcInlineProps {
  price: number;
  brand: string;
  model: string;
  whatsappPhone: string;
  businessName: string;
  siteSlug: string;
}

const DEFAULT_DOWN_PCT = 20;
const DEFAULT_MONTHS = 48;
const MONTHS_OPTIONS = [12, 24, 36, 48, 60] as const;

function parseDigitsToNumber(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

function formatPriceInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return "";
  const n = Number(digits);
  return formatBRL(n);
}

/**
 * Calculadora de financiamento inline no detalhe do veículo (Phase 7 / D2).
 * Reusa Tabela PRICE + disclaimer legal canônico.
 */
export function DetailFinancingCalcInline({
  price: initialPrice,
  brand,
  model,
  whatsappPhone,
  businessName,
  siteSlug,
}: DetailFinancingCalcInlineProps) {
  const priceInputId = useId();
  const downSliderId = useId();
  const monthsSelectId = useId();

  const [priceRaw, setPriceRaw] = useState<string>(formatBRL(initialPrice));
  const [downPct, setDownPct] = useState<number>(DEFAULT_DOWN_PCT);
  const [months, setMonths] = useState<number>(DEFAULT_MONTHS);

  const price = parseDigitsToNumber(priceRaw);
  const deferredPrice = useDeferredValue(price);
  const deferredDown = useDeferredValue(downPct);
  const deferredMonths = useDeferredValue(months);

  const computation = useMemo(() => {
    if (deferredPrice <= 0) return null;
    if (deferredMonths <= 0) return null;
    try {
      return calculateInstallment({
        price: deferredPrice,
        downPaymentPct: deferredDown,
        months: deferredMonths,
        monthlyInterest: DEFAULT_MONTHLY_INTEREST,
      });
    } catch {
      return null;
    }
  }, [deferredPrice, deferredDown, deferredMonths]);

  const installmentDisplay = (() => {
    if (computation === null) return "—";
    if (deferredDown === 100) return "Sem financiamento";
    if (computation.financed === 0) return "Sem financiamento";
    return formatBRL(computation.installment, { fractionDigits: 2 });
  })();

  const whatsappHref = buildWhatsAppLink({
    phone: whatsappPhone,
    businessName,
    siteSlug,
    component: "detail-financing-inline",
    template: "financing",
    finance: {
      carPrice: price > 0 ? price : initialPrice,
      downPaymentPct: downPct,
      months,
      carBrand: brand,
      carModel: model,
    },
  });

  return (
    <div
      data-testid="detail-financing-calculator-inline"
      className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-background p-5"
    >
      <h2 className="text-lg font-semibold text-foreground">
        Simule seu financiamento
      </h2>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={priceInputId}
            className="text-sm font-medium text-foreground"
          >
            Valor do veículo
          </label>
          <input
            id={priceInputId}
            data-testid="detail-financing-price"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={priceRaw}
            onChange={(e) =>
              setPriceRaw(formatPriceInput(e.currentTarget.value))
            }
            onFocus={(e) => e.currentTarget.select()}
            className="rounded-md border border-foreground/15 bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor={downSliderId}
              className="text-sm font-medium text-foreground"
            >
              Entrada
            </label>
            <span
              data-testid="detail-financing-down-display"
              className="text-sm font-semibold tabular-nums text-foreground"
            >
              {downPct}%
            </span>
          </div>
          <input
            id={downSliderId}
            data-testid="detail-financing-down-slider"
            type="range"
            min={0}
            max={50}
            step={5}
            value={downPct}
            onChange={(e) => setDownPct(Number(e.currentTarget.value))}
            aria-valuemin={0}
            aria-valuemax={50}
            aria-valuenow={downPct}
            aria-label="Entrada"
            className="w-full accent-foreground"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={monthsSelectId}
            className="text-sm font-medium text-foreground"
          >
            Prazo
          </label>
          <select
            id={monthsSelectId}
            data-testid="detail-financing-months-select"
            value={months}
            onChange={(e) => setMonths(Number(e.currentTarget.value))}
            className="rounded-md border border-foreground/15 bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
          >
            {MONTHS_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}x
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        aria-live="polite"
        className="flex min-h-[120px] flex-col justify-center gap-1 rounded-xl bg-foreground/[0.04] px-4 py-4"
      >
        <p className="text-xs uppercase tracking-wider text-foreground/60">
          Sua parcela estimada
        </p>
        <p
          data-testid="detail-financing-installment"
          className="text-2xl font-semibold tabular-nums text-foreground md:text-3xl"
        >
          {installmentDisplay}
        </p>
      </div>

      <p
        data-testid="detail-financing-disclaimer"
        className="text-xs text-muted-foreground"
      >
        {DISCLAIMER_TEXT}
      </p>

      <a
        data-testid="detail-financing-whatsapp"
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--auto-whatsapp,#25d366)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--auto-whatsapp-hover,#1fb855)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-whatsapp,#25d366)]",
        )}
      >
        Simular financiamento no WhatsApp
      </a>
    </div>
  );
}
