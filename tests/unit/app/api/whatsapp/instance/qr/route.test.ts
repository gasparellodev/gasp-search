import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const evolutionMocks = vi.hoisted(() => ({
  getQRCode: vi.fn(),
  createEvolutionClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/evolution/client", () => ({
  createEvolutionClient: evolutionMocks.createEvolutionClient,
  EvolutionApiError: class extends Error {
    constructor(
      message: string,
      public options: { status: number; code: string },
    ) {
      super(message);
    }
  },
}));

function makeSupabase(opts: {
  selectData?: unknown;
  selectError?: unknown;
  updateError?: unknown;
}) {
  const maybeSingle = vi.fn(async () => ({
    data: opts.selectData ?? null,
    error: opts.selectError ?? null,
  }));
  const eqSelect = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq: eqSelect }));

  const eqUpdate = vi.fn(async () => ({
    error: opts.updateError ?? null,
  }));
  const update = vi.fn(() => ({ eq: eqUpdate }));

  const from = vi.fn(() => ({ select, update }));

  return {
    client: { auth: { getUser: supabaseMocks.getUser }, from },
    spies: { from, select, eqSelect, maybeSingle, update, eqUpdate },
  };
}

beforeEach(() => {
  vi.resetModules();
  supabaseMocks.getUser.mockReset();
  evolutionMocks.getQRCode.mockReset();
  evolutionMocks.createEvolutionClient.mockReset();
  evolutionMocks.createEvolutionClient.mockReturnValue({
    getQRCode: evolutionMocks.getQRCode,
    createInstance: vi.fn(),
    sendText: vi.fn(),
    getStatus: vi.fn(),
    deleteInstance: vi.fn(),
  });
});

describe("GET /api/whatsapp/instance/qr", () => {
  it("retorna 401 sem usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    supabaseMocks.createServerSupabase.mockResolvedValue({
      auth: { getUser: supabaseMocks.getUser },
    });
    const { GET } = await import("@/app/api/whatsapp/instance/qr/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("retorna disconnected sem chamar Evolution quando não há row", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client } = makeSupabase({ selectData: null });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    const { GET } = await import("@/app/api/whatsapp/instance/qr/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ qrcode: null, status: "disconnected" });
    expect(evolutionMocks.getQRCode).not.toHaveBeenCalled();
  });

  it("retorna QR Code do Evolution e cacheia em DB", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client, spies } = makeSupabase({
      selectData: { evo_instance: "user_xx", status: "qr_pending" },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    evolutionMocks.getQRCode.mockResolvedValue({
      qrcode: "data:image/png;base64,zzz",
      pairingCode: "ABCD",
    });
    const { GET } = await import("@/app/api/whatsapp/instance/qr/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body).toEqual({
      qrcode: "data:image/png;base64,zzz",
      pairingCode: "ABCD",
      status: "qr_pending",
    });
    expect(evolutionMocks.getQRCode).toHaveBeenCalledWith("user_xx");
    expect(spies.update).toHaveBeenCalledWith({
      qr_code: "data:image/png;base64,zzz",
    });
  });

  it("não persiste QR vazio (depois do pareamento)", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client, spies } = makeSupabase({
      selectData: { evo_instance: "user_xx", status: "qr_pending" },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    evolutionMocks.getQRCode.mockResolvedValue({
      qrcode: null,
      pairingCode: null,
    });
    const { GET } = await import("@/app/api/whatsapp/instance/qr/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(spies.update).not.toHaveBeenCalled();
  });

  it("retorna 502 em erro do Evolution", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client } = makeSupabase({
      selectData: { evo_instance: "user_xx", status: "qr_pending" },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    evolutionMocks.getQRCode.mockRejectedValue(new Error("boom"));
    const { GET } = await import("@/app/api/whatsapp/instance/qr/route");
    const res = await GET();
    expect(res.status).toBe(502);
  });
});
