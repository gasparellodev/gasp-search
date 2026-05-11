import {
  calculateInstallment,
  DEFAULT_CARD_DOWN_PCT,
  DEFAULT_CARD_INSTALLMENT_MONTHS,
} from "@/lib/finance";
import type { SiteCar } from "@/types/lead-site";

export type StockSortKey =
  | "most_recent"
  | "price_asc"
  | "price_desc"
  | "installment_asc"
  | "km_asc";

export const STOCK_SORT_OPTIONS: ReadonlyArray<{
  value: StockSortKey;
  label: string;
}> = [
  { value: "most_recent", label: "Mais recentes" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
  { value: "installment_asc", label: "Menor parcela" },
  { value: "km_asc", label: "Menor km" },
];

const STOCK_SORT_KEYS = new Set<StockSortKey>(
  STOCK_SORT_OPTIONS.map((option) => option.value),
);

export function parseStockSortKey(raw: string | undefined | null): StockSortKey {
  return raw && STOCK_SORT_KEYS.has(raw as StockSortKey)
    ? (raw as StockSortKey)
    : "most_recent";
}

export function sortCars(
  cars: ReadonlyArray<SiteCar>,
  sortKey: StockSortKey,
): SiteCar[] {
  return cars
    .map((car, index) => ({ car, index }))
    .toSorted((a, b) => {
      const result = compareCars(a.car, b.car, sortKey);
      return result === 0 ? a.index - b.index : result;
    })
    .map(({ car }) => car);
}

function compareCars(a: SiteCar, b: SiteCar, sortKey: StockSortKey): number {
  switch (sortKey) {
    case "price_asc":
      return compareNullableNumber(a.price, b.price, "asc");
    case "price_desc":
      return compareNullableNumber(a.price, b.price, "desc");
    case "installment_asc":
      return compareNullableNumber(
        installmentValue(a),
        installmentValue(b),
        "asc",
      );
    case "km_asc":
      return a.km - b.km;
    case "most_recent":
      return (
        Number(b.featured) - Number(a.featured) ||
        b.year - a.year ||
        compareNullableNumber(b.price, a.price, "asc")
      );
  }
}

function compareNullableNumber(
  a: number | null,
  b: number | null,
  direction: "asc" | "desc",
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === "asc" ? a - b : b - a;
}

function installmentValue(car: SiteCar): number | null {
  if (car.price === null || car.price <= 0) return null;
  return calculateInstallment({
    price: car.price,
    downPaymentPct: DEFAULT_CARD_DOWN_PCT,
    months: DEFAULT_CARD_INSTALLMENT_MONTHS,
  }).installment;
}
