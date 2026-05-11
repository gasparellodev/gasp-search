/**
 * Mock factory para `apify-client` (issue #203 / Sprint 0 #F6).
 *
 * Espelha o uso real em `lib/apify/*` e `lib/sites/brand-assets.ts`:
 * a SDK é consumida via:
 *   const client = new ApifyClient({token});
 *   const { defaultDatasetId } = await client.actor(id).call({input});
 *   const { items } = await client.dataset(defaultDatasetId).listItems();
 *
 * Por default `actor().call()` retorna `{defaultDatasetId: 'mock-dataset-id'}`
 * e `dataset().listItems()` retorna `{items: []}`. Os tests overridarão
 * com helpers `mockApifyActorRun` e `mockApifyDatasetItems`.
 *
 * ## Como usar (single-actor)
 *
 * ```ts
 * import {
 *   apifyMock,
 *   apifyState,
 *   mockApifyActorRun,
 *   resetApifyMock,
 * } from '@/tests/__mocks__/apify';
 *
 * vi.mock('apify-client', () => apifyMock());
 *
 * beforeEach(() => {
 *   resetApifyMock();
 *   mockApifyActorRun([{name: 'Acme Cars', phone: '11...'}]);
 * });
 * ```
 *
 * ## Como overridar por test
 *
 * `apifyState.actorCall` / `apifyState.datasetListItems` são `vi.fn()`s — use
 * `.mockResolvedValueOnce(...)` ou `.mockRejectedValueOnce(...)` para
 * comportamento per-test.
 */
import { vi } from "vitest";

type AsyncFn = (...args: unknown[]) => Promise<unknown>;

interface ApifyMockState {
  /** vi.fn() que substitui `client.actor(id).call(options)`. */
  actorCall: ReturnType<typeof vi.fn<AsyncFn>>;
  /** vi.fn() que substitui `client.dataset(id).listItems()`. */
  datasetListItems: ReturnType<typeof vi.fn<AsyncFn>>;
  /** Argumento mais recente passado a `.actor(actorId)`. */
  lastActorId: string | null;
  /** Argumento mais recente passado a `.dataset(datasetId)`. */
  lastDatasetId: string | null;
  /** Histórico de argumentos passados ao construtor `new ApifyClient(opts)`. */
  constructorOptions: unknown[];
}

const state: ApifyMockState = {
  actorCall: vi.fn<AsyncFn>(),
  datasetListItems: vi.fn<AsyncFn>(),
  lastActorId: null,
  lastDatasetId: null,
  constructorOptions: [],
};

export const apifyState = state;

/**
 * Factory que retorna o módulo mockado.
 *
 * ```ts
 * vi.mock('apify-client', () => apifyMock());
 * ```
 */
export function apifyMock(): {
  ApifyClient: new (opts: unknown) => unknown;
} {
  class ApifyClient {
    constructor(options: unknown) {
      state.constructorOptions.push(options);
    }
    actor(actorId: string) {
      state.lastActorId = actorId;
      return { call: state.actorCall };
    }
    dataset(datasetId: string) {
      state.lastDatasetId = datasetId;
      return { listItems: state.datasetListItems };
    }
  }
  return { ApifyClient };
}

/**
 * Reseta state entre tests. Use em `beforeEach()`.
 */
export function resetApifyMock(): void {
  state.actorCall.mockReset();
  state.datasetListItems.mockReset();
  state.lastActorId = null;
  state.lastDatasetId = null;
  state.constructorOptions = [];

  // Defaults sãos para não-configured tests:
  state.actorCall.mockResolvedValue({ defaultDatasetId: "mock-dataset-id" });
  state.datasetListItems.mockResolvedValue({ items: [] });
}

/**
 * Configura um run completo (call + listItems) de um actor. Atalho
 * comum: o caller só se importa com os `items` retornados.
 */
export function mockApifyActorRun(
  items: unknown[],
  options: { datasetId?: string } = {},
): void {
  const datasetId = options.datasetId ?? "mock-dataset-id";
  state.actorCall.mockResolvedValue({ defaultDatasetId: datasetId });
  state.datasetListItems.mockResolvedValue({ items });
}

/**
 * Configura apenas o resultado de `dataset().listItems()`. Útil quando o
 * caller já tem `defaultDatasetId` cacheado.
 */
export function mockApifyDatasetItems(items: unknown[]): void {
  state.datasetListItems.mockResolvedValue({ items });
}
