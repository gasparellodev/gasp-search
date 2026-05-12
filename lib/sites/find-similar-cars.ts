/**
 * `findSimilarCars` — algoritmo cross-conversion do bloco "Veículos
 * similares" no detalhe do carro (Phase 7 / Sprint 6 / #D3 — issue #228).
 *
 * **Pure helper, sem I/O.** Recebe o array completo de `cars` do site
 * (`SiteVariablesV2.cars`) + o `current` (carro renderizado na rota) +
 * `limit` (default 4) e retorna duas listas distintas:
 *
 *   - `similar` — carros que casam categoria (ou brand quando categoria
 *     não está disponível) DENTRO da faixa de preço ±20%, ordenados por
 *     proximidade de preço asc.
 *   - `fallback` — top-priced fillers do pool quando `similar.length <
 *     limit`. UI deve renderizar com badge "Você também pode gostar"
 *     pra sinalizar que NÃO são matches do mesmo perfil.
 *
 * **Por que dividir em duas listas?** O componente
 * `<DetailSimilarVehicles>` (issue #228) precisa diferenciar visualmente
 * matches "fortes" (similar) de matches "fracos" (fallback). Retornar
 * `{ similar, fallback }` mantém o lib puro e empurra a decisão de UI
 * pra cima.
 *
 * **Regras de negócio (AC issue #228):**
 *
 *  1. Excluir `current` por `slug` (ignora homônimos defensivamente —
 *     em produção `lead_sites.slug` é global, mas testes podem ter
 *     duplicates).
 *  2. Primary match: mesma `category` quando ambos têm `category`
 *     definida. Fallback brand match quando `current.category` é
 *     `undefined` (retrocompat v1) OU quando nenhum carro casa
 *     `current.category`.
 *  3. Brand match é **case-insensitive** (`toLowerCase()`) — copy
 *     normalmente vem da IA com inconsistências.
 *  4. Faixa de preço ±20% (`[current.price*0.8, current.price*1.2]`)
 *     aplicada APENAS quando `current.price !== null && > 0`. Carros
 *     com `price === null` no pool passam o filtro (não filtra
 *     fora — UI decide se exibe "Sob consulta").
 *  5. Se a faixa zerar o `primary`, RELAXA: mantém o primary inteiro.
 *     "Faixa ±20% vazia" é um sinal de outlier, não de "sem similares".
 *  6. Sort por proximidade de preço (`|price - current.price|` asc).
 *     Carros com `price === null` pesam `Infinity` (vão pro fim).
 *     **Não aplicado** quando `current.price === null` (sem âncora de
 *     proximidade — preserva ordem original).
 *  7. Fallback top-priced completa até `limit`: pool excl. similar +
 *     excl. current, filtrado por `price > 0`, ordenado por preço desc.
 *  8. Quando o pool total se esgota antes de atingir `limit`, retorna
 *     listas curtas (componente decide empty state + CTA "Ver estoque
 *     completo").
 *
 * **Decisões V1 (NÃO mudar sem PO):**
 *
 *  - Sem filtro por `status === 'sold'` ou `available === false` — pra
 *    V1 todos os carros do payload são considerados. Adicionar quando a
 *    issue #228 for fechada e o feedback indicar necessidade.
 *  - Sem heurística por `year` ou `km` no V1. AC pede só category/brand
 *    + price band.
 *  - Sem random/shuffle — ordem é determinística pra evitar layout
 *    shift entre re-renders.
 *
 * **Coverage target ≥95% lines** (AC issue #228). Tests em
 * `tests/unit/lib/sites/find-similar-cars.test.ts`.
 */
import type { SiteCar } from "@/types/lead-site";

/**
 * Resultado de `findSimilarCars`. UI distingue:
 *
 *   - `similar` — exibido sem badge (matches fortes).
 *   - `fallback` — exibido com badge "Você também pode gostar"
 *     (matches fracos, completou pra atingir `limit`).
 *
 * Total `similar.length + fallback.length <= limit`.
 */
export interface FindSimilarCarsResult {
  similar: SiteCar[];
  fallback: SiteCar[];
}

const PRICE_BAND_PCT = 0.2; // ±20%

/**
 * Encontra carros similares ao `current` no array de `cars` do site.
 *
 * @param cars — array completo do estoque (`SiteVariablesV2.cars`).
 * @param current — carro renderizado na rota do detalhe.
 * @param limit — número máximo de cards retornados (default 4 conforme #228).
 * @returns `{ similar, fallback }` — duas listas ordenadas; total ≤ limit.
 */
export function findSimilarCars(
  cars: readonly SiteCar[],
  current: SiteCar,
  limit = 4,
): FindSimilarCarsResult {
  // 1. Pool sem o atual (exclude por slug, defensivo contra homônimos).
  const pool = cars.filter((c) => c.slug !== current.slug);

  if (pool.length === 0) {
    return { similar: [], fallback: [] };
  }

  // 2. Primary match: same category quando possível, brand fallback.
  const sameCategory =
    current.category !== undefined
      ? pool.filter((c) => c.category === current.category)
      : [];
  const sameBrand = pool.filter(
    (c) => c.brand.toLowerCase() === current.brand.toLowerCase(),
  );

  const primary = sameCategory.length > 0 ? sameCategory : sameBrand;

  // 3. Filter por faixa de preço ±20% (só se current.price > 0).
  // Carros com price === null no pool passam o filtro (sem comparação possível).
  let withinBand: SiteCar[] = primary;
  if (typeof current.price === "number" && current.price > 0) {
    const anchor = current.price;
    const low = anchor * (1 - PRICE_BAND_PCT);
    const high = anchor * (1 + PRICE_BAND_PCT);
    withinBand = primary.filter((c) => {
      if (c.price === null) return true;
      return c.price >= low && c.price <= high;
    });
    // Faixa zerou? Relaxa pra preservar o primary inteiro.
    if (withinBand.length === 0) {
      withinBand = primary;
    }
  }

  // 4. Sort por proximidade (somente quando current.price !== null).
  let sorted: SiteCar[] = withinBand;
  if (typeof current.price === "number" && current.price > 0) {
    const anchor = current.price;
    sorted = [...withinBand].sort((a, b) => {
      const da = a.price !== null ? Math.abs(a.price - anchor) : Infinity;
      const db = b.price !== null ? Math.abs(b.price - anchor) : Infinity;
      return da - db;
    });
  }

  const similar = sorted.slice(0, limit);

  // 5. Fallback top-priced — completa até limit, excluindo já em similar.
  const remaining = limit - similar.length;
  let fallback: SiteCar[] = [];
  if (remaining > 0) {
    const usedSlugs = new Set(similar.map((c) => c.slug));
    fallback = pool
      .filter(
        (c) =>
          !usedSlugs.has(c.slug) && c.price !== null && c.price > 0,
      )
      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
      .slice(0, remaining);
  }

  return { similar, fallback };
}
