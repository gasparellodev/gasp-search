/**
 * Tests do helper `checkDailyInstanceLimit`
 * (`lib/whatsapp/daily-limit.ts` — issue #173).
 *
 * Hard-limit anti-ban WhatsApp: bloqueia >50 sends/dia/instância. Como
 * `whatsapp_instances` é 1:1 com `user_id`, a query de count por
 * `user_id` em `lead_messages` (direction='outbound', janela 24h
 * rolling) é suficiente — não há `instance_id` em `lead_messages`,
 * mas o user só pode ter uma instância conectada por vez (UNIQUE em
 * `whatsapp_instances.user_id`).
 *
 * Cobre:
 *   - count=0 (allowed: true)
 *   - count<50 (allowed: true)
 *   - count=50 (allowed: false — boundary inclusive)
 *   - count>50 (allowed: false)
 *   - count=null (allowed: true — fail-open em DB hiccup)
 *   - error retornado pelo Supabase (allowed: true — fail-open)
 *   - query usa janela 24h (gte com timestamp ~ now() - 24h)
 *   - query filtra direction='outbound'
 *   - query filtra user_id
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { checkDailyInstanceLimit, DAILY_INSTANCE_LIMIT } = await import(
  "@/lib/whatsapp/daily-limit"
);

type MockResult = {
  count: number | null;
  error: { message: string } | null;
};

function makeSupabase(result: MockResult) {
  const eqs: Array<[string, unknown]> = [];
  const gtes: Array<[string, unknown]> = [];
  let selectOpts: { count?: string; head?: boolean } | undefined;
  let selectedTable: string | null = null;

  const builder: Record<string, unknown> = {};
  builder.select = vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
    selectOpts = opts;
    return builder;
  });
  builder.eq = vi.fn((col: string, val: unknown) => {
    eqs.push([col, val]);
    return builder;
  });
  builder.gte = vi.fn((col: string, val: unknown) => {
    gtes.push([col, val]);
    return builder;
  });
  builder.then = vi.fn((onResolve: (x: unknown) => unknown) =>
    Promise.resolve(onResolve(result)),
  );

  const from = vi.fn((table: string) => {
    selectedTable = table;
    return builder;
  });

  return {
    client: { from } as unknown,
    inspect: () => ({ table: selectedTable, eqs, gtes, selectOpts }),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-09T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DAILY_INSTANCE_LIMIT", () => {
  it("é exportado como 50 (decisão V1 do produto, anti-ban WhatsApp)", () => {
    expect(DAILY_INSTANCE_LIMIT).toBe(50);
  });
});

describe("checkDailyInstanceLimit — boundary cases", () => {
  it("count=0 → allowed: true (sem nenhum envio nas últimas 24h)", async () => {
    const { client } = makeSupabase({ count: 0, error: null });

    const result = await checkDailyInstanceLimit(
      "user-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
    );

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.current).toBe(0);
    }
  });

  it("count=49 → allowed: true (próximo do limite mas ainda permitido)", async () => {
    const { client } = makeSupabase({ count: 49, error: null });

    const result = await checkDailyInstanceLimit(
      "user-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
    );

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.current).toBe(49);
    }
  });

  it("count=50 → allowed: false (boundary inclusive — atingiu o limite)", async () => {
    const { client } = makeSupabase({ count: 50, error: null });

    const result = await checkDailyInstanceLimit(
      "user-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
    );

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.current).toBe(50);
      expect(result.limit).toBe(50);
    }
  });

  it("count=51 → allowed: false (acima do limite)", async () => {
    const { client } = makeSupabase({ count: 51, error: null });

    const result = await checkDailyInstanceLimit(
      "user-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
    );

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.current).toBe(51);
      expect(result.limit).toBe(50);
    }
  });
});

describe("checkDailyInstanceLimit — fail-open em DB hiccup", () => {
  it("count=null → allowed: true (defesa em profundidade — não bloqueia user em hiccup)", async () => {
    const { client } = makeSupabase({ count: null, error: null });

    const result = await checkDailyInstanceLimit(
      "user-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
    );

    // count null vira 0 → allowed
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.current).toBe(0);
    }
  });

  it("error do Supabase → allowed: true (fail-open consistente com rate-limit do generateLeadSite)", async () => {
    const { client } = makeSupabase({
      count: null,
      error: { message: "DB unavailable" },
    });

    const result = await checkDailyInstanceLimit(
      "user-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
    );

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.current).toBe(0);
    }
  });
});

describe("checkDailyInstanceLimit — query shape", () => {
  it("consulta tabela lead_messages com count exact + head", async () => {
    const { client, inspect } = makeSupabase({ count: 10, error: null });

    await checkDailyInstanceLimit(
      "user-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
    );

    const probe = inspect();
    expect(probe.table).toBe("lead_messages");
    expect(probe.selectOpts).toEqual({ count: "exact", head: true });
  });

  it("filtra por user_id (= isolamento da instância 1:1 user)", async () => {
    const { client, inspect } = makeSupabase({ count: 10, error: null });

    await checkDailyInstanceLimit(
      "user-abc",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
    );

    const probe = inspect();
    expect(probe.eqs).toContainEqual(["user_id", "user-abc"]);
  });

  it("filtra por direction='outbound' (apenas envios contam pro hard-limit)", async () => {
    const { client, inspect } = makeSupabase({ count: 10, error: null });

    await checkDailyInstanceLimit(
      "user-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
    );

    const probe = inspect();
    expect(probe.eqs).toContainEqual(["direction", "outbound"]);
  });

  it("filtra janela rolling 24h (gte com created_at = now-24h)", async () => {
    const { client, inspect } = makeSupabase({ count: 10, error: null });

    await checkDailyInstanceLimit(
      "user-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
    );

    const probe = inspect();
    // Esperado: gte('created_at', '2026-05-08T12:00:00Z')
    expect(probe.gtes.length).toBe(1);
    const [col, val] = probe.gtes[0]!;
    expect(col).toBe("created_at");
    expect(val).toBe("2026-05-08T12:00:00.000Z");
  });
});
