/**
 * Mock factory para o client Supabase (issue #203 / Sprint 0 #F6).
 *
 * Espelha o uso real em `lib/supabase/{client,server,service}.ts`. O client
 * Supabase tem uma API chainable que é dolorosa de mockar inline; este
 * helper produz um client com `.from(table)` retornando um query builder
 * thenable que cobre os 5 métodos terminais usados no projeto:
 *
 *   - `.select(...).eq(...).maybeSingle()` → `{data, error}`
 *   - `.select(...).eq(...).single()`      → `{data, error}`
 *   - `.select(...)`                       → `{data, error}` (list/await)
 *   - `.insert(...).select().single()`     → `{data, error}`
 *   - `.update(...).eq(...)`               → `{data, error}` (await)
 *   - `.upsert(...)`                       → `{data, error}` (await)
 *   - `.delete().eq(...)`                  → `{data, error}` (await)
 *
 * O default é `{data: null, error: null}` para single-row ops e
 * `{data: [], error: null}` para list. Override por tabela via `overrides`.
 *
 * ## Como usar (1 — default empty)
 *
 * ```ts
 * import { vi } from 'vitest';
 * import { createMockSupabaseClient } from '@/tests/__mocks__/supabase';
 *
 * const supabase = createMockSupabaseClient();
 * vi.mock('@/lib/supabase/service', () => ({
 *   createServiceSupabase: () => supabase,
 * }));
 * ```
 *
 * ## Como usar (2 — override por tabela)
 *
 * ```ts
 * const supabase = createMockSupabaseClient({
 *   tables: {
 *     lead_sites: {
 *       selectSingle: { data: makeLeadSite(), error: null },
 *     },
 *     leads: {
 *       selectList: { data: [makeLead(), makeLead()], error: null },
 *     },
 *   },
 * });
 * ```
 *
 * ## Como assertar calls
 *
 * O retorno expõe `.fromCalls: string[]` (lista de nomes de tabela
 * tocados em ordem) e os builders são `vi.fn()`s acessíveis via
 * `.builders[tableName]`. Use:
 *
 * ```ts
 * expect(supabase.fromCalls).toContain('lead_sites');
 * expect(supabase.builders.lead_sites.update).toHaveBeenCalledWith({
 *   status: 'published',
 * });
 * ```
 */
import { vi } from "vitest";

export interface SupabaseResult<T = unknown> {
  data: T | null;
  error: unknown;
}

/**
 * Override de comportamento por tabela. Cada chave reflete um caminho
 * terminal da query chain.
 */
export interface TableOverride {
  /** `.select(...).eq(...).maybeSingle()` */
  maybeSingle?: SupabaseResult;
  /** `.select(...).eq(...).single()` ou `.insert(...).select().single()` */
  selectSingle?: SupabaseResult;
  /** `.select(...)` await direto (lista) */
  selectList?: SupabaseResult<unknown[]>;
  /** `.insert(...)` await direto (sem `.select()` depois) */
  insert?: SupabaseResult;
  /** `.update(...).eq(...)` await direto */
  update?: SupabaseResult;
  /** `.upsert(...)` await direto */
  upsert?: SupabaseResult;
  /** `.delete().eq(...)` await direto */
  delete?: SupabaseResult;
}

export interface MockSupabaseOptions {
  tables?: Record<string, TableOverride>;
}

/**
 * Tipo callable + spy de `vi.fn`. Evita TS2348 (Mock<Procedure |
 * Constructable>) quando o consumer faz `client.from("x")` — vi.fn é
 * tipado como ambíguo (callable OR newable). Cast pra
 * `MockFn<A, R>` ancora no chamado.
 */
type MockFn<Args extends unknown[], R> = ((...args: Args) => R) & {
  mock: ReturnType<typeof vi.fn>["mock"];
  mockReturnValue: ReturnType<typeof vi.fn>["mockReturnValue"];
  mockResolvedValue: ReturnType<typeof vi.fn>["mockResolvedValue"];
  mockReset: ReturnType<typeof vi.fn>["mockReset"];
};

/**
 * Builder vi.fn()s expostos pra asserts. Espelha os métodos da chain.
 */
export interface MockTableBuilder {
  select: MockFn<[unknown?], MockTableBuilder>;
  insert: MockFn<[unknown?], MockTableBuilder>;
  update: MockFn<[unknown?], MockTableBuilder>;
  upsert: MockFn<[unknown?], MockTableBuilder>;
  delete: MockFn<[unknown?], MockTableBuilder>;
  eq: MockFn<[string, unknown], MockTableBuilder>;
  in: MockFn<[string, unknown[]], MockTableBuilder>;
  not: MockFn<[string, string, unknown], MockTableBuilder>;
  order: MockFn<[string, unknown?], MockTableBuilder>;
  limit: MockFn<[number], MockTableBuilder>;
  single: MockFn<[], Promise<SupabaseResult>>;
  maybeSingle: MockFn<[], Promise<SupabaseResult>>;
}

export interface MockSupabaseClient {
  /** `.from(table)` mock. */
  from: MockFn<[string], MockTableBuilder>;
  /** Tabelas tocadas em ordem. */
  fromCalls: string[];
  /** Builders por tabela (acessível via `client.builders[name]`). */
  builders: Record<string, MockTableBuilder>;
}

const DEFAULT_RESULT: SupabaseResult = { data: null, error: null };
const DEFAULT_LIST_RESULT: SupabaseResult<unknown[]> = {
  data: [],
  error: null,
};

/**
 * Cria um client Supabase mockado com chainable query builder. O builder
 * é thenable: `await client.from('x').select()` resolve com `{data, error}`.
 *
 * Caveat: este mock cobre os patterns reais usados no projeto. Patterns
 * exóticos (`.rpc()`, realtime channels, `.range()`, `.or()`) caem fora
 * — adicione conforme necessário.
 */
export function createMockSupabaseClient(
  options: MockSupabaseOptions = {},
): MockSupabaseClient {
  const overrides = options.tables ?? {};
  const builders: Record<string, MockTableBuilder> = {};
  const fromCalls: string[] = [];

  /** Promise terminal — usada quando o caller `await`-a o builder. */
  function makeBuilder(table: string): MockTableBuilder & PromiseLike<unknown> {
    const tableOverride: TableOverride = overrides[table] ?? {};

    // Cada terminal default: select list, mas se o caller encadear .single()
    // ou .maybeSingle() reescrevemos o `pendingResult`.
    let pendingResult: SupabaseResult | SupabaseResult<unknown[]> =
      tableOverride.selectList ?? DEFAULT_LIST_RESULT;
    let mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";

    const builder = {} as MockTableBuilder & PromiseLike<unknown>;

    builder.select = vi.fn(() => {
      mode = "select";
      pendingResult = tableOverride.selectList ?? DEFAULT_LIST_RESULT;
      return builder;
    }) as unknown as MockTableBuilder["select"];
    builder.insert = vi.fn(() => {
      mode = "insert";
      pendingResult = tableOverride.insert ?? DEFAULT_RESULT;
      return builder;
    }) as unknown as MockTableBuilder["insert"];
    builder.update = vi.fn(() => {
      mode = "update";
      pendingResult = tableOverride.update ?? DEFAULT_RESULT;
      return builder;
    }) as unknown as MockTableBuilder["update"];
    builder.upsert = vi.fn(() => {
      mode = "upsert";
      pendingResult = tableOverride.upsert ?? DEFAULT_RESULT;
      return builder;
    }) as unknown as MockTableBuilder["upsert"];
    builder.delete = vi.fn(() => {
      mode = "delete";
      pendingResult = tableOverride.delete ?? DEFAULT_RESULT;
      return builder;
    }) as unknown as MockTableBuilder["delete"];

    // Filtros / modifiers: retornam o próprio builder e preservam `pendingResult`.
    builder.eq = vi.fn(() => builder) as unknown as MockTableBuilder["eq"];
    builder.in = vi.fn(() => builder) as unknown as MockTableBuilder["in"];
    builder.not = vi.fn(() => builder) as unknown as MockTableBuilder["not"];
    builder.order = vi.fn(() => builder) as unknown as MockTableBuilder["order"];
    builder.limit = vi.fn(() => builder) as unknown as MockTableBuilder["limit"];

    // Terminais de single-row.
    builder.single = vi.fn(() => {
      const result = tableOverride.selectSingle ?? DEFAULT_RESULT;
      return Promise.resolve(result);
    }) as unknown as MockTableBuilder["single"];
    builder.maybeSingle = vi.fn(() => {
      const result = tableOverride.maybeSingle ?? DEFAULT_RESULT;
      return Promise.resolve(result);
    }) as unknown as MockTableBuilder["maybeSingle"];

    // Thenable: permite `await client.from('x').update(...).eq(...)`.
    builder.then = ((onFulfilled, onRejected) => {
      void mode; // mode é informativo; pendingResult já foi atribuído.
      return Promise.resolve(pendingResult).then(onFulfilled, onRejected);
    }) as PromiseLike<unknown>["then"];

    return builder;
  }

  const from = vi.fn((table: string) => {
    fromCalls.push(table);
    if (!builders[table]) {
      builders[table] = makeBuilder(table);
    }
    return builders[table];
  }) as unknown as MockSupabaseClient["from"];

  return { from, fromCalls, builders };
}
