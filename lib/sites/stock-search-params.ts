/**
 * Quick search params compartilhados entre Home (#221 / H1) e Estoque (#224 / E1).
 *
 * Fonte única de verdade pro querystring do quick search — keys curtas
 * (`m`, `model`, `p`) acordadas no PO refinement de #221.
 *
 * **Por que keys curtas?** Linkbar/share copy mais limpo (URLs Q.S. costumam
 * vazar pra textos de WhatsApp/Instagram), e a Home/Estoque dividem o mesmo
 * vocabulário desde o V1 — sem migração futura.
 *
 * **Pure module — zero deps `lib/`/`server-only`/network/fs.** Pode ser
 * importado em Client Components (`HomeQuickSearchBar` H1) e em Server
 * Components/Route Handlers (#224 E1 / `/estoque` page).
 */

import {
  calculateInstallment,
  DEFAULT_CARD_DOWN_PCT,
  DEFAULT_CARD_INSTALLMENT_MONTHS,
} from "@/lib/finance";
import type { SiteCar } from "@/types/lead-site";

/** Input do `serializeQuickSearch`. Campos opcionais; cada um pode ser null/undefined/"". */
export interface QuickSearchInput {
  /** Marca do veículo (ex.: "Toyota"). Vai pra key `m`. */
  brand?: string | null;
  /** Modelo do veículo (ex.: "Corolla"). Vai pra key `model`. */
  model?: string | null;
  /** Preço máximo em BRL (centavos ou reais inteiros — caller decide). Vai pra key `p`. */
  priceMax?: number | null;
}

/**
 * Output do `parseQuickSearch`. Cada campo é `null` quando ausente/inválido —
 * caller pode aplicar fallback semantics próprios (ex.: pré-preencher input).
 */
export interface ParsedQuickSearch {
  brand: string | null;
  model: string | null;
  priceMax: number | null;
}

/** Input genérico aceito pelo parser (Next searchParams + URLSearchParams). */
export type QuickSearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

const QS_KEY_BRAND = "m";
const QS_KEY_MODEL = "model";
const QS_KEY_PRICE_MAX = "p";

const STOCK_KEY_SEARCH = "q";
const STOCK_KEY_CATEGORY = "c";
const STOCK_KEY_LEGACY_CATEGORY = "categoria";
const STOCK_KEY_PRICE_MIN = "pmin";
const STOCK_KEY_PRICE_MAX = "pmax";
const STOCK_KEY_INSTALLMENT_MIN = "imin";
const STOCK_KEY_INSTALLMENT_MAX = "imax";
const STOCK_KEY_YEAR_MIN = "ymin";
const STOCK_KEY_YEAR_MAX = "ymax";
const STOCK_KEY_KM_MIN = "kmmin";
const STOCK_KEY_KM_MAX = "kmmax";
const STOCK_KEY_TRANSMISSION = "tr";
const STOCK_KEY_FUEL = "fl";
const STOCK_KEY_COLOR = "cor";

export type StockCategorySlug =
  | "sedan"
  | "suv"
  | "hatch"
  | "pickup"
  | "esportivo"
  | "conversivel";

export interface StockFilters {
  search: string | null;
  marca: string[];
  modelo: string[];
  categoria: StockCategorySlug[];
  precoMin: number | null;
  precoMax: number | null;
  parcelaMin: number | null;
  parcelaMax: number | null;
  anoMin: number | null;
  anoMax: number | null;
  kmMin: number | null;
  kmMax: number | null;
  cambio: SiteCar["transmission"][];
  combustivel: SiteCar["fuel"][];
  cor: string[];
  passthrough?: Record<string, string>;
}

export type ParsedStockFilters = StockFilters & {
  passthrough: Record<string, string>;
};

export interface StockFilterFacets {
  marcas: string[];
  modelos: string[];
  categorias: StockCategorySlug[];
  cambios: SiteCar["transmission"][];
  combustiveis: SiteCar["fuel"][];
  cores: string[];
  ranges: {
    preco: { min: number; max: number };
    parcela: { min: number; max: number };
    ano: { min: number; max: number };
    km: { min: number; max: number };
  };
}

const STOCK_KNOWN_KEYS = new Set([
  STOCK_KEY_SEARCH,
  QS_KEY_BRAND,
  QS_KEY_MODEL,
  QS_KEY_PRICE_MAX,
  STOCK_KEY_CATEGORY,
  STOCK_KEY_LEGACY_CATEGORY,
  STOCK_KEY_PRICE_MIN,
  STOCK_KEY_PRICE_MAX,
  STOCK_KEY_INSTALLMENT_MIN,
  STOCK_KEY_INSTALLMENT_MAX,
  STOCK_KEY_YEAR_MIN,
  STOCK_KEY_YEAR_MAX,
  STOCK_KEY_KM_MIN,
  STOCK_KEY_KM_MAX,
  STOCK_KEY_TRANSMISSION,
  STOCK_KEY_FUEL,
  STOCK_KEY_COLOR,
]);

const STOCK_CATEGORY_SLUGS: readonly StockCategorySlug[] = [
  "sedan",
  "suv",
  "hatch",
  "pickup",
  "esportivo",
  "conversivel",
];

const TRANSMISSIONS: readonly SiteCar["transmission"][] = [
  "Manual",
  "Automático",
  "CVT",
  "Outros",
];

const FUELS: readonly SiteCar["fuel"][] = [
  "Gasolina",
  "Etanol",
  "Flex",
  "Diesel",
  "Híbrido",
  "Elétrico",
];

function readValue(
  input: QuickSearchParamsInput,
  key: string,
): string | undefined {
  if (input instanceof URLSearchParams) {
    return input.get(key) ?? undefined;
  }
  const v = input[key];
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) return v[0];
  return v;
}

function entriesFromInput(input: QuickSearchParamsInput): Array<[string, string]> {
  if (input instanceof URLSearchParams) {
    return Array.from(input.entries());
  }
  return Object.entries(input).flatMap(([key, value]) => {
    if (value === undefined || value === null) return [];
    if (Array.isArray(value)) {
      const first = value[0];
      return first === undefined ? [] : [[key, first]];
    }
    return [[key, value]];
  });
}

function trimOrNull(raw: string | undefined | null): string | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parsePriceMax(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return Math.floor(n);
}

function parsePositiveInt(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  const value = Math.floor(n);
  return value >= 0 ? value : null;
}

function parseYear(raw: string | undefined | null): number | null {
  const value = parsePositiveInt(raw);
  if (value === null) return null;
  return value >= 1900 && value <= new Date().getFullYear() + 1
    ? value
    : null;
}

function parseCsv(raw: string | undefined | null): string[] {
  if (raw === undefined || raw === null) return [];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const part of raw.split(",")) {
    const value = part.trim();
    if (value.length === 0) continue;
    const key = value.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(value);
  }
  return values;
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function parseCategories(raw: string | undefined | null): StockCategorySlug[] {
  const aliases: Record<string, StockCategorySlug> = {
    sedan: "sedan",
    suv: "suv",
    hatch: "hatch",
    pickup: "pickup",
    picape: "pickup",
    esportivo: "esportivo",
    conversivel: "conversivel",
    "conversível": "conversivel",
  };
  const seen = new Set<StockCategorySlug>();
  const values: StockCategorySlug[] = [];
  for (const part of parseCsv(raw)) {
    const category = aliases[normalize(part)];
    if (!category || seen.has(category)) continue;
    seen.add(category);
    values.push(category);
  }
  return values;
}

function parseEnumCsv<T extends string>(
  raw: string | undefined | null,
  allowed: readonly T[],
): T[] {
  const allowedByKey = new Map(allowed.map((v) => [normalize(v), v]));
  const seen = new Set<T>();
  const values: T[] = [];
  for (const part of parseCsv(raw)) {
    const value = allowedByKey.get(normalize(part));
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
}

function parseColors(raw: string | undefined | null): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const color of parseCsv(raw)) {
    const normalized = normalize(color);
    if (normalized.length === 0 || seen.has(normalized)) continue;
    seen.add(normalized);
    values.push(normalized);
  }
  return values;
}

function hasPriceFilter(filters: StockFilters): boolean {
  return (
    filters.precoMin !== null ||
    filters.precoMax !== null ||
    filters.parcelaMin !== null ||
    filters.parcelaMax !== null
  );
}

/**
 * Serializa input de quick search pra querystring (sem prefixo `?`).
 *
 * - Campos vazios/null/undefined são OMITIDOS — não emite `m=&model=`.
 * - `brand`/`model` recebem `.trim()` — espaços nas pontas são ruído.
 * - `priceMax` ≤ 0 ou NaN é OMITIDO (preço inválido).
 * - `priceMax` decimal é arredondado para inteiro via `Math.floor`.
 * - Caracteres especiais codificados via `URLSearchParams` (espaço → `+`, `&` → `%26`).
 *
 * Ordem das keys estável: `m`, `model`, `p` — facilita snapshot/diff/share.
 */
export function serializeQuickSearch(input: QuickSearchInput): string {
  const params = new URLSearchParams();
  const brand = trimOrNull(input.brand);
  if (brand) params.set(QS_KEY_BRAND, brand);
  const model = trimOrNull(input.model);
  if (model) params.set(QS_KEY_MODEL, model);
  const priceMax = parsePriceMax(
    typeof input.priceMax === "number"
      ? String(input.priceMax)
      : input.priceMax,
  );
  if (priceMax !== null) params.set(QS_KEY_PRICE_MAX, String(priceMax));
  return params.toString();
}

/**
 * Parseia querystring (ou Next `searchParams`) pra shape interno.
 *
 * - Aceita `URLSearchParams` ou `Record<string, string | string[] | undefined>`
 *   (compatível com Next.js searchParams quando multi-value possível).
 * - Em array, usa o primeiro item — convenção Next.
 * - Campos ausentes/whitespace → `null`.
 * - `priceMax` não-numérico, negativo ou zero → `null`.
 */
export function parseQuickSearch(
  input: QuickSearchParamsInput,
): ParsedQuickSearch {
  return {
    brand: trimOrNull(readValue(input, QS_KEY_BRAND)),
    model: trimOrNull(readValue(input, QS_KEY_MODEL)),
    priceMax: parsePriceMax(readValue(input, QS_KEY_PRICE_MAX)),
  };
}

export function parseStockFilters(input: QuickSearchParamsInput): ParsedStockFilters {
  const passthrough: Record<string, string> = {};
  for (const [key, value] of entriesFromInput(input)) {
    if (!STOCK_KNOWN_KEYS.has(key) && value.trim().length > 0) {
      passthrough[key] = value;
    }
  }

  const legacyPriceMax = readValue(input, QS_KEY_PRICE_MAX);
  const categoryRaw =
    readValue(input, STOCK_KEY_CATEGORY) ??
    readValue(input, STOCK_KEY_LEGACY_CATEGORY);

  return {
    search: trimOrNull(readValue(input, STOCK_KEY_SEARCH)),
    marca: parseCsv(readValue(input, QS_KEY_BRAND)),
    modelo: parseCsv(readValue(input, QS_KEY_MODEL)),
    categoria: parseCategories(categoryRaw),
    precoMin: parsePositiveInt(readValue(input, STOCK_KEY_PRICE_MIN)),
    precoMax: parsePositiveInt(
      readValue(input, STOCK_KEY_PRICE_MAX) ?? legacyPriceMax,
    ),
    parcelaMin: parsePositiveInt(readValue(input, STOCK_KEY_INSTALLMENT_MIN)),
    parcelaMax: parsePositiveInt(readValue(input, STOCK_KEY_INSTALLMENT_MAX)),
    anoMin: parseYear(readValue(input, STOCK_KEY_YEAR_MIN)),
    anoMax: parseYear(readValue(input, STOCK_KEY_YEAR_MAX)),
    kmMin: parsePositiveInt(readValue(input, STOCK_KEY_KM_MIN)),
    kmMax: parsePositiveInt(readValue(input, STOCK_KEY_KM_MAX)),
    cambio: parseEnumCsv(readValue(input, STOCK_KEY_TRANSMISSION), TRANSMISSIONS),
    combustivel: parseEnumCsv(readValue(input, STOCK_KEY_FUEL), FUELS),
    cor: parseColors(readValue(input, STOCK_KEY_COLOR)),
    passthrough,
  };
}

export function serializeStockFilters(filters: StockFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters.passthrough ?? {})) {
    if (!STOCK_KNOWN_KEYS.has(key) && value.trim().length > 0) {
      params.set(key, value);
    }
  }

  const search = trimOrNull(filters.search);
  if (search) params.set(STOCK_KEY_SEARCH, search);
  if (filters.marca.length > 0) params.set(QS_KEY_BRAND, filters.marca.join(","));
  if (filters.modelo.length > 0) {
    params.set(QS_KEY_MODEL, filters.modelo.join(","));
  }
  if (filters.categoria.length > 0) {
    params.set(STOCK_KEY_CATEGORY, filters.categoria.join(","));
  }
  setInt(params, STOCK_KEY_PRICE_MIN, filters.precoMin);
  setInt(params, STOCK_KEY_PRICE_MAX, filters.precoMax);
  setInt(params, STOCK_KEY_INSTALLMENT_MIN, filters.parcelaMin);
  setInt(params, STOCK_KEY_INSTALLMENT_MAX, filters.parcelaMax);
  setInt(params, STOCK_KEY_YEAR_MIN, filters.anoMin);
  setInt(params, STOCK_KEY_YEAR_MAX, filters.anoMax);
  setInt(params, STOCK_KEY_KM_MIN, filters.kmMin);
  setInt(params, STOCK_KEY_KM_MAX, filters.kmMax);
  if (filters.cambio.length > 0) {
    params.set(STOCK_KEY_TRANSMISSION, filters.cambio.join(","));
  }
  if (filters.combustivel.length > 0) {
    params.set(STOCK_KEY_FUEL, filters.combustivel.join(","));
  }
  if (filters.cor.length > 0) {
    params.set(STOCK_KEY_COLOR, filters.cor.join(","));
  }
  return params.toString();
}

function setInt(params: URLSearchParams, key: string, value: number | null): void {
  if (value === null) return;
  if (!Number.isFinite(value)) return;
  params.set(key, String(Math.floor(value)));
}

export function applyStockFilters(
  cars: ReadonlyArray<SiteCar>,
  filters: StockFilters,
): SiteCar[] {
  const search = filters.search ? normalize(filters.search) : null;
  const marcas = new Set(filters.marca.map(normalize));
  const modelos = new Set(filters.modelo.map(normalize));
  const categorias = new Set(filters.categoria);
  const cambios = new Set(filters.cambio);
  const combustiveis = new Set(filters.combustivel);
  const cores = new Set(filters.cor.map(normalize));
  const needsPrice = hasPriceFilter(filters);

  return cars.filter((car) => {
    if (search) {
      const haystack = normalize(
        [car.brand, car.model, car.version ?? ""].join(" "),
      );
      if (!haystack.includes(search)) return false;
    }
    if (marcas.size > 0 && !marcas.has(normalize(car.brand))) return false;
    if (modelos.size > 0 && !modelos.has(normalize(car.model))) return false;
    if (categorias.size > 0) {
      const category = inferCategorySlug(car);
      if (category === null || !categorias.has(category)) return false;
    }
    if (car.year < (filters.anoMin ?? Number.NEGATIVE_INFINITY)) return false;
    if (car.year > (filters.anoMax ?? Number.POSITIVE_INFINITY)) return false;
    if (car.km < (filters.kmMin ?? Number.NEGATIVE_INFINITY)) return false;
    if (car.km > (filters.kmMax ?? Number.POSITIVE_INFINITY)) return false;
    if (cambios.size > 0 && !cambios.has(car.transmission)) return false;
    if (combustiveis.size > 0 && !combustiveis.has(car.fuel)) return false;
    if (cores.size > 0 && !cores.has(normalize(car.color))) return false;

    if (needsPrice) {
      if (car.price === null) return false;
      if (filters.precoMin !== null && car.price < filters.precoMin) return false;
      if (filters.precoMax !== null && car.price > filters.precoMax) return false;

      const installment = calculateInstallment({
        price: car.price,
        downPaymentPct: DEFAULT_CARD_DOWN_PCT,
        months: DEFAULT_CARD_INSTALLMENT_MONTHS,
      }).installment;
      if (filters.parcelaMin !== null && installment < filters.parcelaMin) {
        return false;
      }
      if (filters.parcelaMax !== null && installment > filters.parcelaMax) {
        return false;
      }
    }

    return true;
  });
}

export function buildStockFilterFacets(
  cars: ReadonlyArray<SiteCar>,
): StockFilterFacets {
  const prices = cars.map((car) => car.price).filter((p): p is number => p !== null);
  const installments = prices.map(
    (price) =>
      calculateInstallment({
        price,
        downPaymentPct: DEFAULT_CARD_DOWN_PCT,
        months: DEFAULT_CARD_INSTALLMENT_MONTHS,
      }).installment,
  );
  const years = cars.map((car) => car.year);
  const kms = cars.map((car) => car.km);

  return {
    marcas: uniqueSorted(cars.map((car) => car.brand)),
    modelos: uniqueSorted(cars.map((car) => car.model)),
    categorias: [...STOCK_CATEGORY_SLUGS],
    cambios: uniqueByAllowed(cars.map((car) => car.transmission), TRANSMISSIONS),
    combustiveis: uniqueByAllowed(cars.map((car) => car.fuel), FUELS),
    cores: uniqueSorted(cars.map((car) => normalize(car.color))),
    ranges: {
      preco: rangeFromNumbers(prices, 0, 0),
      parcela: rangeFromNumbers(
        installments.map((value) => Math.floor(value)),
        0,
        0,
      ),
      ano: rangeFromNumbers(
        years,
        2000,
        new Date().getFullYear() + 1,
      ),
      km: rangeFromNumbers(kms, 0, 0),
    },
  };
}

export function countActiveStockFilters(filters: StockFilters): number {
  return (
    (filters.search ? 1 : 0) +
    filters.marca.length +
    filters.modelo.length +
    filters.categoria.length +
    Number(filters.precoMin !== null) +
    Number(filters.precoMax !== null) +
    Number(filters.parcelaMin !== null) +
    Number(filters.parcelaMax !== null) +
    Number(filters.anoMin !== null) +
    Number(filters.anoMax !== null) +
    Number(filters.kmMin !== null) +
    Number(filters.kmMax !== null) +
    filters.cambio.length +
    filters.combustivel.length +
    filters.cor.length
  );
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

function uniqueByAllowed<T extends string>(
  values: Iterable<T>,
  allowed: readonly T[],
): T[] {
  const present = new Set(values);
  return allowed.filter((value) => present.has(value));
}

function rangeFromNumbers(
  values: readonly number[],
  fallbackMin: number,
  fallbackMax: number,
): { min: number; max: number } {
  if (values.length === 0) return { min: fallbackMin, max: fallbackMax };
  return { min: Math.min(...values), max: Math.max(...values) };
}

function inferCategorySlug(car: SiteCar): StockCategorySlug | null {
  const heuristic = inferCategoryFromText(`${car.brand} ${car.model}`);
  if (heuristic !== null) return heuristic;
  if (!car.category) return null;
  return categoryFromLabel(car.category);
}

function categoryFromLabel(label: string): StockCategorySlug | null {
  const key = normalize(label);
  if (key === "pickup" || key === "picape") return "pickup";
  if (key === "conversivel") return "conversivel";
  return STOCK_CATEGORY_SLUGS.includes(key as StockCategorySlug)
    ? (key as StockCategorySlug)
    : null;
}

function inferCategoryFromText(input: string): StockCategorySlug | null {
  const text = normalize(input);
  if (/\b(strada|toro|ranger|hilux|s10|amarok|frontier)\b/.test(text)) {
    return "pickup";
  }
  if (/\b(mustang|camaro|porsche|boxster|cayman|tt)\b/.test(text)) {
    return "esportivo";
  }
  if (/\b(t-cross|tcross|tracker|compass|renegade|creta|hr-v|hrv|suv)\b/.test(text)) {
    return "suv";
  }
  if (/\b(corolla|civic|sentra|virtus|jetta|versa|sedan)\b/.test(text)) {
    return "sedan";
  }
  if (/\b(hb20|onix|argo|kwid|gol|hatch)\b/.test(text)) {
    return "hatch";
  }
  if (/\b(conversivel|conversível|cabrio|roadster)\b/.test(text)) {
    return "conversivel";
  }
  return null;
}
