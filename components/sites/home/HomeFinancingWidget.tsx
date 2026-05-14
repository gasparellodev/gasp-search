"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";

import { BanksStrip } from "@/components/sites/BanksStrip";
import { trackEvent } from "@/lib/analytics/track-event";
import {
  calculateInstallment,
  DEFAULT_MONTHLY_INTEREST,
  DISCLAIMER_TEXT,
  formatBRL,
} from "@/lib/finance";
import { buildWhatsAppLink } from "@/lib/whatsapp";

interface HomeFinancingWidgetProps {
  /** Telefone E.164 BR sem `+` (validado upstream em SiteVariables). */
  whatsappPhone: string;
  /** Nome do negócio (mensagem do WhatsApp). */
  businessName: string;
  /** Slug do site — entra em `utm_term` do deep-link WhatsApp. */
  siteSlug: string;
}

const DEFAULT_PRICE = 50000;
const DEFAULT_DOWN_PCT = 20;
const DEFAULT_MONTHS = 48;

const MONTHS_OPTIONS = [12, 24, 36, 48, 60] as const;

/**
 * Bloco "Simule seu financiamento" da Home (Phase 7 / Sprint 4 / #H2 — issue #222).
 *
 * Client Component (precisa de state para inputs + cálculo real-time).
 *
 * Diferencial competitivo nº 2: calculadora INLINE no Hero da Home (apenas
 * ~1/14 sites BR de seminovos têm). Reusa `lib/finance.ts:calculateInstallment`
 * (Tabela PRICE com taxa default 1.99% a.m.).
 *
 * Anatomia:
 *   - Split 6/6 desktop. Left: copy + `<BanksStrip>`. Right: form + output.
 *   - Inputs: price (mask vanilla via `useState` + `formatBRL` no display),
 *     slider entrada 0–50% step 5%, select prazo {12, 24, 36, 48, 60}.
 *   - Output `aria-live="polite"` para leitores de tela.
 *   - DISCLAIMER_TEXT obrigatório abaixo do output (CDC + Bacen).
 *   - CTA "Simular financiamento" → WhatsApp template `financing` pré-fill.
 *
 * **Mask vanilla** (PO decision A): nenhuma dep extra (`react-input-mask`,
 * `imask` NÃO instalados). Display formatado via `formatBRL`, parse no
 * blur/change via `parseDigitsToNumber`.
 *
 * **Layout shift = 0**: output card tem `min-height` fixo (224px desktop,
 * 200px mobile) — string "—" ou valor formatado nunca alteram altura.
 *
 * **Debounce via `useDeferredValue`**: input mantém responsivo, cálculo
 * roda em low priority. Sem `setTimeout` manual (React 19 idiom).
 */
export function HomeFinancingWidget({
  whatsappPhone,
  businessName,
  siteSlug,
}: HomeFinancingWidgetProps) {
  const priceInputId = useId();
  const downSliderId = useId();
  const monthsSelectId = useId();

  const [priceRaw, setPriceRaw] = useState<string>(formatBRL(DEFAULT_PRICE));
  const [downPct, setDownPct] = useState<number>(DEFAULT_DOWN_PCT);
  const [months, setMonths] = useState<number>(DEFAULT_MONTHS);
  const financingTracked = useRef(false);

  const price = parseDigitsToNumber(priceRaw);

  // Defer values: cálculo roda em low priority — input fica responsivo.
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

  useEffect(() => {
    if (financingTracked.current) return;
    if (computation === null) return;
    if (deferredPrice <= 0) return;
    financingTracked.current = true;
    trackEvent("financing_calc", { source: "home_financing_widget" });
  }, [computation, deferredPrice]);

  const installmentDisplay = (() => {
    if (computation === null) return "—";
    if (deferredDown === 100) return "Sem financiamento";
    if (computation.financed === 0) return "Sem financiamento";
    return formatBRL(computation.installment, { fractionDigits: 2 });
  })();

  const financedDisplay =
    computation === null
      ? "—"
      : formatBRL(computation.financed, { fractionDigits: 0 });

  // WhatsApp deep-link — usa `general` se price=0 (sem contexto suficiente).
  const whatsappHref =
    price > 0
      ? buildWhatsAppLink({
          phone: whatsappPhone,
          businessName,
          siteSlug,
          component: "home-cta",
          template: "financing",
          finance: {
            carPrice: price,
            downPaymentPct: downPct,
            months,
          },
        })
      : buildWhatsAppLink({
          phone: whatsappPhone,
          businessName,
          siteSlug,
          component: "home-cta",
          template: "general",
        });

  return (
    <section
      data-testid="home-financing-widget"
      data-reveal
      className="w-full border-y border-foreground/10 bg-foreground/[0.02]"
      aria-labelledby="home-financing-widget-title"
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-2 md:gap-12 md:px-8 md:py-16">
        {/* Left — copy + banks strip */}
        <div className="flex flex-col gap-5">
          <h2
            id="home-financing-widget-title"
            className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
          >
            Simule seu financiamento
          </h2>
          <p className="max-w-md text-sm text-foreground/70 md:text-base">
            Estimativa imediata da parcela com nossos bancos parceiros.
            Aprovação em até 24h — sem burocracia, sem sair de casa.
          </p>
          <BanksStrip />
        </div>

        {/* Right — form + output */}
        <div className="flex flex-col gap-5 rounded-2xl border border-foreground/10 bg-background p-5 shadow-sm md:p-6">
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
                data-testid="financing-price-input"
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
                  data-testid="financing-down-display"
                  className="text-sm font-semibold tabular-nums text-foreground"
                >
                  {downPct}%
                </span>
              </div>
              <input
                id={downSliderId}
                data-testid="financing-down-slider"
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
                data-testid="financing-months-select"
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

          {/* Output — height fixo (layout shift 0). aria-live polite. */}
          <div
            data-testid="financing-output"
            aria-live="polite"
            className="flex min-h-[200px] flex-col justify-center gap-2 rounded-xl bg-foreground/[0.04] px-4 py-4 md:min-h-[224px] md:px-5"
          >
            <p className="text-xs uppercase tracking-wider text-foreground/60">
              Sua parcela estimada
            </p>
            <p
              data-testid="financing-installment"
              className="text-3xl font-semibold tabular-nums text-foreground md:text-4xl"
            >
              {installmentDisplay}
            </p>
            <p className="text-sm text-foreground/70">
              Valor financiado: <span className="tabular-nums">{financedDisplay}</span>
            </p>
          </div>

          <p className="text-xs text-muted-foreground">{DISCLAIMER_TEXT}</p>

          <a
            data-testid="financing-cta"
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackEvent("whatsapp_click", { component: "home-financing-widget" });
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--auto-whatsapp,#25d366)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--auto-whatsapp-hover,#1fb855)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-whatsapp,#25d366)]"
          >
            Simular financiamento no WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * Converte string formatada BRL (ex.: "R$ 50.000" / "50.000" / "50000") para
 * número via dígitos puros. Tolerante a entrada parcial (sem throw — retorna
 * `0` quando vazio). Tirado inline para evitar dep externa de mask.
 */
function parseDigitsToNumber(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Re-formata o input enquanto o usuário digita. Mantém apenas dígitos e
 * exibe via `formatBRL`. Permite string vazia (UX: usuário consegue limpar
 * o campo sem o display "saltar" para R$ 0).
 */
function formatPriceInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return "";
  const n = Number(digits);
  return formatBRL(n);
}
