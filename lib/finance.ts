/**
 * Finance helpers para o Site Generator (Sprint 0 / #F4 — issue #201).
 *
 * Reusado em:
 *   - `<CarCard>` (Sprint 0) — installment "Ou Nx de R$ Y" abaixo do preço.
 *   - `<HomeFinancingWidget>` (Sprint 4 / H2) — simulador no Hero.
 *   - `<StockGrid>` card (Sprint 5 / E2).
 *   - `<CarDetail>` price-block (Sprint 6 / D2) + Similar vehicles (D3).
 *
 * **Foco V1:** PT-BR, BRL, fórmula PRICE (juros compostos sobre saldo
 * devedor). i18n e outras moedas ficam para V2.
 *
 * Decisões:
 *   - Taxa default = **1.99% a.m.** — média de mercado BR para seminovos
 *     em concessionárias (CDC) em 2026. Exportada como
 *     `DEFAULT_MONTHLY_INTEREST` para teste/override.
 *   - `formatBRL` defaults a `maximumFractionDigits: 0` (alinha com
 *     `StockGrid` legado). Aceita `{ fractionDigits }` opcional para o
 *     widget H2 que pode querer 2 decimais.
 *   - `slugifyVehicle` **NÃO** usa `id4` (sufixo do `id`) — `SiteCar` não
 *     tem campo `id`, só `slug`. Colisão (ex: duas Civic 2020 na mesma
 *     concessionária) é aceita no MVP — slug do payload (`car.slug`) já
 *     vem único upstream; helper é para display/SEO. TODO V2: disambig
 *     opcional via hash.
 */

/** Taxa mensal default — 1.99% a.m. (~26.6% a.a.) em CDC BR seminovos 2026. */
export const DEFAULT_MONTHLY_INTEREST = 0.0199;

/** Default de parcelas em cards de listagem. */
export const DEFAULT_CARD_INSTALLMENT_MONTHS = 48;

/** Default de % de entrada em cards de listagem. */
export const DEFAULT_CARD_DOWN_PCT = 20;

export interface CalculateInstallmentInput {
  /** Preço total à vista do veículo em reais (BRL). */
  price: number;
  /** Percentual de entrada (0-100). 30 = 30% de entrada. */
  downPaymentPct: number;
  /** Número de parcelas (inteiro, > 0). */
  months: number;
  /** Taxa mensal de juros (0-1). Default `DEFAULT_MONTHLY_INTEREST`. */
  monthlyInterest?: number;
}

export interface CalculateInstallmentResult {
  /** Valor financiado após dedução da entrada. */
  financed: number;
  /** Valor de cada parcela (com juros). */
  installment: number;
  /** Total pago (entrada + soma das parcelas). */
  total: number;
}

/**
 * Calcula parcela de financiamento via Tabela PRICE.
 *
 * Fórmula: `installment = financed × (i × (1+i)^n) / ((1+i)^n − 1)`
 *
 * Edge cases:
 *   - `price === 0` → retorna tudo zerado (sem throw).
 *   - `downPaymentPct === 100` → financed=0, installment=0, total=price.
 *   - `monthlyInterest === 0` → fórmula degenerada `installment = financed/months`.
 *
 * @throws {RangeError} se `price < 0`, `downPaymentPct ∉ [0,100]`,
 *   `months <= 0`, `months` não-inteiro, ou `monthlyInterest < 0`.
 */
export function calculateInstallment(
  input: CalculateInstallmentInput,
): CalculateInstallmentResult {
  const {
    price,
    downPaymentPct,
    months,
    monthlyInterest = DEFAULT_MONTHLY_INTEREST,
  } = input;

  if (price < 0) {
    throw new RangeError(`calculateInstallment: price must be >= 0 (got ${price})`);
  }
  if (downPaymentPct < 0 || downPaymentPct > 100) {
    throw new RangeError(
      `calculateInstallment: downPaymentPct must be in [0, 100] (got ${downPaymentPct})`,
    );
  }
  if (!Number.isInteger(months) || months <= 0) {
    throw new RangeError(
      `calculateInstallment: months must be a positive integer (got ${months})`,
    );
  }
  if (monthlyInterest < 0) {
    throw new RangeError(
      `calculateInstallment: monthlyInterest must be >= 0 (got ${monthlyInterest})`,
    );
  }

  const downPayment = price * (downPaymentPct / 100);
  const financed = price - downPayment;

  if (financed === 0) {
    return { financed: 0, installment: 0, total: price };
  }

  let installment: number;
  if (monthlyInterest === 0) {
    installment = financed / months;
  } else {
    const i = monthlyInterest;
    const n = months;
    const factor = Math.pow(1 + i, n);
    installment = (financed * (i * factor)) / (factor - 1);
  }

  const total = installment * months + downPayment;

  return { financed, installment, total };
}

export interface FormatBRLOptions {
  /** Casas decimais. Default 0 (BRL inteiro, alinhado com listagens). */
  fractionDigits?: number;
}

/**
 * Formata número como moeda BRL (`R$ X.XXX` ou `R$ X.XXX,XX`).
 *
 * Default `maximumFractionDigits: 0` (alinha com `StockGrid` legado).
 * Use `{ fractionDigits: 2 }` quando precisar de centavos
 * (e.g., `<HomeFinancingWidget>` da Sprint 4).
 *
 * **Aceita valor negativo** sem throw — Intl formata com sinal.
 */
export function formatBRL(value: number, options: FormatBRLOptions = {}): string {
  const { fractionDigits = 0 } = options;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export interface SlugifyVehicleInput {
  brand: string;
  model: string;
  year: number;
}

/**
 * Gera slug determinístico `{brand}-{model}-{year}` normalizado para
 * casar a regex `/^[a-z0-9-]+$/` de `SiteCar.slug`.
 *
 * Normalizações:
 *   - NFKD + strip diacritics (`Citroën` → `citroen`).
 *   - lowercase.
 *   - Substitui `[^a-z0-9-]` por `-`.
 *   - Colapsa múltiplos `-` consecutivos.
 *   - Trim de `-` nas pontas.
 *
 * **Não disambigua colisões** (V1) — concessionária com 2 Civic 2020
 * tem 2 cars com mesmo slug derivado. Caller (admin form, gen pipeline)
 * já garante unicidade no payload via `car.slug`. Esse helper é só pra
 * display/SEO em rotas que ainda não tem slug pre-computado.
 */
export function slugifyVehicle(input: SlugifyVehicleInput): string {
  const raw = `${input.brand} ${input.model} ${input.year}`;
  return raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (Combining Diacritical Marks block)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-") // non-alphanum → hífen
    .replace(/-+/g, "-") // colapsa múltiplos hífens
    .replace(/^-+|-+$/g, ""); // trim hífens das pontas
}
