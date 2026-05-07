import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const getLeadMock = vi.hoisted(() => vi.fn());
const updateLeadMock = vi.hoisted(() => vi.fn());
const deleteLeadMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/leads/crud", () => ({
  getLead: getLeadMock,
  updateLead: updateLeadMock,
  deleteLead: deleteLeadMock,
  createLead: vi.fn(),
}));

function makeRequest(method: string, body?: unknown) {
  return new Request("http://localhost:3000/api/leads/lead-1", {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function importRoute() {
  return import("@/app/api/leads/[id]/route");
}

const ctx = { params: Promise.resolve({ id: "lead-1" }) };

beforeEach(() => {
  vi.resetModules();
  getLeadMock.mockReset();
  updateLeadMock.mockReset();
  deleteLeadMock.mockReset();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  supabaseMocks.createServerSupabase.mockResolvedValue({
    auth: { getUser: supabaseMocks.getUser },
  });
});

describe("GET /api/leads/[id]", () => {
  it("401 sem auth", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { GET } = await importRoute();
    const response = await GET(makeRequest("GET"), ctx);
    expect(response.status).toBe(401);
  });

  it("404 quando RLS bloqueia ou lead inexistente", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    getLeadMock.mockResolvedValue(null);
    const { GET } = await importRoute();
    const response = await GET(makeRequest("GET"), ctx);
    expect(response.status).toBe(404);
  });

  it("200 com lead", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    getLeadMock.mockResolvedValue({ id: "lead-1", name: "X", tags: [] });
    const { GET } = await importRoute();
    const response = await GET(makeRequest("GET"), ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "lead-1" });
  });
});

describe("PATCH /api/leads/[id]", () => {
  it("401 sem auth", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { PATCH } = await importRoute();
    const response = await PATCH(
      makeRequest("PATCH", { stage: "contacted" }),
      ctx,
    );
    expect(response.status).toBe(401);
  });

  it("400 quando body inválido", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { PATCH } = await importRoute();
    const response = await PATCH(makeRequest("PATCH", {}), ctx);
    expect(response.status).toBe(400);
  });

  it("404 quando RLS bloqueia (lead de outro user)", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    updateLeadMock.mockResolvedValue(null);
    const { PATCH } = await importRoute();
    const response = await PATCH(
      makeRequest("PATCH", { stage: "qualified" }),
      ctx,
    );
    expect(response.status).toBe(404);
  });

  it("200 com lead atualizado", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    updateLeadMock.mockResolvedValue({
      id: "lead-1",
      stage: "contacted",
      tags: [],
    });
    const { PATCH } = await importRoute();
    const response = await PATCH(
      makeRequest("PATCH", { stage: "contacted" }),
      ctx,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ id: "lead-1", stage: "contacted" });
  });
});

describe("DELETE /api/leads/[id]", () => {
  it("401 sem auth", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { DELETE } = await importRoute();
    const response = await DELETE(makeRequest("DELETE"), ctx);
    expect(response.status).toBe(401);
  });

  it("404 quando RLS bloqueia (0 rows)", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    deleteLeadMock.mockResolvedValue(false);
    const { DELETE } = await importRoute();
    const response = await DELETE(makeRequest("DELETE"), ctx);
    expect(response.status).toBe(404);
  });

  it("204 quando deletado com sucesso", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    deleteLeadMock.mockResolvedValue(true);
    const { DELETE } = await importRoute();
    const response = await DELETE(makeRequest("DELETE"), ctx);
    expect(response.status).toBe(204);
  });
});
