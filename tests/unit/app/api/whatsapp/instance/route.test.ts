import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
  fromHandlers: new Map<string, unknown>(),
  resetFromHandlers: () => {
    /* set per-test */
  },
}));

const evolutionMocks = vi.hoisted(() => ({
  createInstance: vi.fn(),
  deleteInstance: vi.fn(),
  createEvolutionClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/evolution/client", () => ({
  createEvolutionClient: evolutionMocks.createEvolutionClient,
  EvolutionApiError: class EvolutionApiError extends Error {
    status: number;
    code: string;
    constructor(message: string, options: { status: number; code: string }) {
      super(message);
      this.name = "EvolutionApiError";
      this.status = options.status;
      this.code = options.code;
    }
  },
}));

type SelectChain = {
  data?: unknown;
  error?: unknown;
};

function makeSupabase(opts: {
  whatsappInstanceSelect?: SelectChain;
  whatsappInstanceUpsertError?: unknown;
  whatsappInstanceDeleteError?: unknown;
}) {
  const maybeSingle = vi.fn(async () => ({
    data: opts.whatsappInstanceSelect?.data ?? null,
    error: opts.whatsappInstanceSelect?.error ?? null,
  }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));

  const upsert = vi.fn(async () => ({
    error: opts.whatsappInstanceUpsertError ?? null,
  }));

  const deleteEq = vi.fn(async () => ({
    error: opts.whatsappInstanceDeleteError ?? null,
  }));
  const deleteFn = vi.fn(() => ({ eq: deleteEq }));

  const from = vi.fn(() => ({
    select,
    upsert,
    delete: deleteFn,
  }));

  return {
    client: {
      auth: { getUser: supabaseMocks.getUser },
      from,
    },
    spies: { from, select, eq, maybeSingle, upsert, deleteFn, deleteEq },
  };
}

beforeEach(() => {
  vi.resetModules();
  supabaseMocks.getUser.mockReset();
  evolutionMocks.createInstance.mockReset();
  evolutionMocks.deleteInstance.mockReset();
  evolutionMocks.createEvolutionClient.mockReset();
  evolutionMocks.createEvolutionClient.mockReturnValue({
    createInstance: evolutionMocks.createInstance,
    deleteInstance: evolutionMocks.deleteInstance,
    getQRCode: vi.fn(),
    sendText: vi.fn(),
    getStatus: vi.fn(),
  });
});

describe("GET /api/whatsapp/instance", () => {
  it("retorna 401 sem usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    supabaseMocks.createServerSupabase.mockResolvedValue({
      auth: { getUser: supabaseMocks.getUser },
    });
    const { GET } = await import("@/app/api/whatsapp/instance/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("retorna disconnected quando não há row", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client } = makeSupabase({ whatsappInstanceSelect: { data: null } });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    const { GET } = await import("@/app/api/whatsapp/instance/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      status: "disconnected",
      phoneNumber: null,
      lastSeenAt: null,
    });
  });

  it("retorna estado salvo quando existe row", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client } = makeSupabase({
      whatsappInstanceSelect: {
        data: {
          status: "connected",
          phone_number: "5511999",
          last_seen_at: "2026-05-08T10:00:00Z",
        },
      },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    const { GET } = await import("@/app/api/whatsapp/instance/route");
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({
      status: "connected",
      phoneNumber: "5511999",
      lastSeenAt: "2026-05-08T10:00:00Z",
    });
  });

  it("retorna 502 em erro do supabase", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client } = makeSupabase({
      whatsappInstanceSelect: { error: new Error("rls") },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    const { GET } = await import("@/app/api/whatsapp/instance/route");
    const res = await GET();
    expect(res.status).toBe(502);
  });
});

describe("POST /api/whatsapp/instance", () => {
  it("retorna 401 sem usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    supabaseMocks.createServerSupabase.mockResolvedValue({
      auth: { getUser: supabaseMocks.getUser },
    });
    const { POST } = await import("@/app/api/whatsapp/instance/route");
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("cria instância com slug nanoid não-previsível e faz upsert com status qr_pending (#130)", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "11111111-2222-3333-4444-555555555555" } },
      error: null,
    });
    const { client, spies } = makeSupabase({});
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    evolutionMocks.createInstance.mockImplementation(async (slug: string) => ({
      instanceName: slug,
      status: "qr_pending",
      qrcode: "data:image/png;base64,xxx",
    }));
    const { POST } = await import("@/app/api/whatsapp/instance/route");
    const res = await POST();
    expect(res.status).toBe(201);

    // Slug deve seguir o alfabeto nanoid (`A-Za-z0-9_-`) com 16 chars.
    // Sem o `user_` prefix legado — esse era o vetor enumerável de #130.
    const slugArg = evolutionMocks.createInstance.mock.calls[0]?.[0];
    expect(slugArg).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(slugArg).not.toMatch(/^user_/);

    expect(spies.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "11111111-2222-3333-4444-555555555555",
        evo_instance: slugArg,
        evo_instance_v2: slugArg,
        status: "qr_pending",
        qr_code: "data:image/png;base64,xxx",
      }),
      { onConflict: "user_id" },
    );
    const body = await res.json();
    expect(body).toMatchObject({
      status: "qr_pending",
      qrcode: "data:image/png;base64,xxx",
    });
  });

  it("respeita status connected vindo do Evolution", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "11111111-2222-3333-4444-555555555555" } },
      error: null,
    });
    const { client, spies } = makeSupabase({});
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    evolutionMocks.createInstance.mockImplementation(async (slug: string) => ({
      instanceName: slug,
      status: "connected",
      qrcode: null,
    }));
    const { POST } = await import("@/app/api/whatsapp/instance/route");
    await POST();
    expect(spies.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "connected" }),
      { onConflict: "user_id" },
    );
  });

  it("mapeia 401 do Evolution para 502 com mensagem específica", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client } = makeSupabase({});
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    const { EvolutionApiError } = await import("@/lib/evolution/client");
    evolutionMocks.createInstance.mockRejectedValue(
      new EvolutionApiError("unauth", { status: 401, code: "UNAUTHORIZED" }),
    );
    const { POST } = await import("@/app/api/whatsapp/instance/route");
    const res = await POST();
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/EVOLUTION_API_KEY/);
  });
});

describe("DELETE /api/whatsapp/instance", () => {
  it("retorna 401 sem usuário", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    supabaseMocks.createServerSupabase.mockResolvedValue({
      auth: { getUser: supabaseMocks.getUser },
    });
    const { DELETE } = await import("@/app/api/whatsapp/instance/route");
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("remove no Evolution e na tabela quando há row", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client, spies } = makeSupabase({
      whatsappInstanceSelect: {
        data: { evo_instance: "user_aabbcc" },
      },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    evolutionMocks.deleteInstance.mockResolvedValue(undefined);
    const { DELETE } = await import("@/app/api/whatsapp/instance/route");
    const res = await DELETE();
    expect(res.status).toBe(204);
    expect(evolutionMocks.deleteInstance).toHaveBeenCalledWith("user_aabbcc");
    expect(spies.deleteFn).toHaveBeenCalled();
  });

  it("tolera 404 do Evolution e ainda deleta a row local", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client, spies } = makeSupabase({
      whatsappInstanceSelect: { data: { evo_instance: "user_aabbcc" } },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    const { EvolutionApiError } = await import("@/lib/evolution/client");
    evolutionMocks.deleteInstance.mockRejectedValue(
      new EvolutionApiError("nf", { status: 404, code: "HTTP_ERROR" }),
    );
    const { DELETE } = await import("@/app/api/whatsapp/instance/route");
    const res = await DELETE();
    expect(res.status).toBe(204);
    expect(spies.deleteFn).toHaveBeenCalled();
  });

  it("não chama Evolution se não há row local", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const { client, spies } = makeSupabase({
      whatsappInstanceSelect: { data: null },
    });
    supabaseMocks.createServerSupabase.mockResolvedValue(client);
    const { DELETE } = await import("@/app/api/whatsapp/instance/route");
    const res = await DELETE();
    expect(res.status).toBe(204);
    expect(evolutionMocks.deleteInstance).not.toHaveBeenCalled();
    expect(spies.deleteFn).toHaveBeenCalled();
  });
});
