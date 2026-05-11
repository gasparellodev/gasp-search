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
