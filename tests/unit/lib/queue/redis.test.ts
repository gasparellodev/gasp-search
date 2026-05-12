import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock `ioredis` antes do import dinâmico. Cada teste verifica a contagem
// de construções do client — caso queiramos detectar regressão no singleton.
const RedisCtor = vi.fn();
vi.mock("ioredis", () => ({
  default: function (this: unknown, ...args: unknown[]) {
    RedisCtor(...args);
    return {
      _args: args,
      quit: vi.fn(async () => "OK"),
      disconnect: vi.fn(),
    };
  },
}));

beforeEach(() => {
  vi.resetModules();
  RedisCtor.mockReset();
  process.env.REDIS_URL = "redis://localhost:6380";
});

describe("lib/queue/redis", () => {
  it("getRedis() constrói um client com a URL do env e maxRetriesPerRequest=null (BullMQ requirement)", async () => {
    const { getRedis } = await import("@/lib/queue/redis");
    const client = getRedis();
    expect(client).toBeDefined();
    expect(RedisCtor).toHaveBeenCalledTimes(1);
    expect(RedisCtor).toHaveBeenCalledWith(
      "redis://localhost:6380",
      expect.objectContaining({ maxRetriesPerRequest: null }),
    );
  });

  it("getRedis() é singleton — segunda chamada não constrói novo client", async () => {
    const { getRedis } = await import("@/lib/queue/redis");
    const a = getRedis();
    const b = getRedis();
    expect(RedisCtor).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("respeita REDIS_URL com auth (rediss://) — não força http(s) refine", async () => {
    process.env.REDIS_URL = "rediss://user:pass@cloud.example.com:6380";
    // Precisa resetar para o módulo `lib/env` reavaliar process.env.
    vi.resetModules();
    const { getRedis } = await import("@/lib/queue/redis");
    getRedis();
    expect(RedisCtor).toHaveBeenCalledWith(
      "rediss://user:pass@cloud.example.com:6380",
      expect.objectContaining({ maxRetriesPerRequest: null }),
    );
  });

  it("resetRedis() (helper de teste) libera o singleton", async () => {
    const { getRedis, _resetRedis } = await import("@/lib/queue/redis");
    getRedis();
    expect(RedisCtor).toHaveBeenCalledTimes(1);
    _resetRedis();
    getRedis();
    expect(RedisCtor).toHaveBeenCalledTimes(2);
  });
});
