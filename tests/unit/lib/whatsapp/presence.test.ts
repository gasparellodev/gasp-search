import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
}));

vi.mock("@/lib/queue/redis", () => ({
  getRedis: () => redisMock,
}));

beforeEach(() => {
  vi.resetModules();
  redisMock.set.mockReset();
  redisMock.get.mockReset();
});

describe("lib/whatsapp/presence", () => {
  it("persiste presença do lead no Redis com TTL de 60s", async () => {
    const { setLeadPresence } = await import("@/lib/whatsapp/presence");
    const now = new Date("2026-05-12T12:00:00Z");

    await setLeadPresence({
      userId: "user-1",
      leadId: "lead-1",
      presence: "typing",
      now,
    });

    expect(redisMock.set).toHaveBeenCalledWith(
      "whatsapp:presence:user-1:lead-1",
      JSON.stringify({
        presence: "typing",
        lastSeen: "2026-05-12T12:00:00.000Z",
      }),
      "EX",
      60,
    );
  });

  it("retorna offline quando a chave expirou ou o JSON está inválido", async () => {
    const { getLeadPresence } = await import("@/lib/whatsapp/presence");
    redisMock.get.mockResolvedValueOnce(null);
    await expect(
      getLeadPresence({ userId: "user-1", leadId: "lead-1" }),
    ).resolves.toEqual({ presence: "offline", lastSeen: null });

    redisMock.get.mockResolvedValueOnce("{broken");
    await expect(
      getLeadPresence({ userId: "user-1", leadId: "lead-1" }),
    ).resolves.toEqual({ presence: "offline", lastSeen: null });
  });
});
