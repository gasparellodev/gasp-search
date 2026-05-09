import "server-only";

import manifest from "./stock-photos.manifest.json";
import {
  stockManifestSchema,
  type StockCarEntry,
} from "./stock-photos.schema";

/**
 * Manifest validado no boot. Top-level `parse` lança no startup do servidor
 * caso o JSON seja editado pra um shape inválido — preferível a 500 silencioso
 * em runtime quando `pickCarStock` é chamado pelo `extractBrandAssets`.
 */
const validatedManifest = stockManifestSchema.parse(manifest);

/** Total de carros no banco V1 — exportado pra mensagens de erro testáveis. */
export const STOCK_PHOTOS_TOTAL = validatedManifest.cars.length;

/**
 * Hash determinístico de string (cyrb53-light) — usado pra derivar o seed
 * inicial do PRNG a partir do `seed: string`. Reimplementado inline pra
 * manter a função pura e zero-dependência.
 */
function hashSeed(seed: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  // Garante valor não-negativo no range Uint32.
  return (h1 ^ h2) >>> 0;
}

/**
 * PRNG Mulberry32 — pequeno, rápido, determinístico e suficiente pra
 * embaralhamento. Não usar pra crypto.
 *
 * Ref: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle parametrizado por uma função de random. Não muta a
 * entrada — retorna cópia.
 */
function shuffleWith<T>(items: ReadonlyArray<T>, rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

export interface PickCarStockParams {
  /**
   * Tipo de negócio. Hoje só `'concessionaria'` é suportado — futuras
   * verticais (motos, jet ski, etc.) virão como union string literal.
   */
  business_type: "concessionaria";
  /** Quantos carros retornar. Deve ser ≥ 0 e ≤ `STOCK_PHOTOS_TOTAL`. */
  count: number;
  /**
   * Seed opcional. Quando informado, garante reprodutibilidade — o mesmo
   * seed retorna a mesma ordem em qualquer máquina/processo. Crítico pra
   * `lead_sites.variables.car_placeholder_urls` ficar estável em re-renders.
   * Sem seed, usa `Math.random()` (não-determinístico, mas suficiente pra
   * preview ad-hoc).
   */
  seed?: string;
}

/**
 * Seleciona N carros do banco curado V1 pra alimentar o placeholder do
 * preview do site (`extractBrandAssets` → `lead_sites.variables.car_placeholder_urls`).
 *
 * Garantias:
 * - Retorna entries únicos (sem repetição) — garantido por shuffle + slice.
 * - Determinístico quando `seed` é fornecido (Mulberry32 PRNG).
 * - `count = 0` → retorna `[]` (não erro).
 * - `count > STOCK_PHOTOS_TOTAL` → lança erro com count solicitado vs disponível.
 *
 * @example
 * pickCarStock({ business_type: 'concessionaria', count: 6, seed: lead.id })
 */
export function pickCarStock(params: PickCarStockParams): StockCarEntry[] {
  const { count, seed } = params;

  if (count < 0) {
    throw new Error(`pickCarStock: count must be ≥ 0 (received ${count})`);
  }
  if (count > STOCK_PHOTOS_TOTAL) {
    throw new Error(
      `pickCarStock: count exceeds total available stock (${count} requested, ${STOCK_PHOTOS_TOTAL} available)`,
    );
  }
  if (count === 0) return [];

  const rand =
    seed !== undefined ? mulberry32(hashSeed(seed)) : Math.random;
  const shuffled = shuffleWith(validatedManifest.cars, rand);
  return shuffled.slice(0, count);
}

export type { StockCarEntry } from "./stock-photos.schema";
