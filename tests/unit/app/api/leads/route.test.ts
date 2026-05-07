import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const listLeadsMock = vi.hoisted(() => vi.fn());
const createLeadMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/leads/list-leads", () => ({
  listLeads: listLeadsMock,
}));

vi.mock("@/lib/leads/crud", () => ({
  createLead: createLeadMock,
  getLead: vi.fn(),
  updateLead: vi.fn(),
  deleteLead: vi.fn(),
}));

function makeGetRequest(url: string) {
  return new Request(url, { method: "GET" });
}

function makePostRequest(body: unknown) {
  return new Request("http://localhost:3000/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function importRoute() {
  return import("@/app/api/leads/route");
}

beforeEach(() => {
  vi.resetModules();
  listLeadsMock.mockReset();
  createLeadMock.mockReset();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  supabaseMocks.createServerSupabase.mockResolvedValue({
    auth: { getUser: supabaseMocks.getUser },
  });
});

describe("GET /api/leads", () => {
  it("retorna 401 quando não há usuário autenticado", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { GET } = await importRoute();
    const response = await GET(makeGetRequest("http://localhost/api/leads"));
    expect(response.status).toBe(401);
  });

  it("retorna { data, total } com filtros aplicados", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    listLeadsMock.mockResolvedValue({
      leads: [{ id: "lead-1", name: "X", tags: [] }],
      totalCount: 137,
      page: 2,
      pageSize: 50,
      totalPages: 3,
    });
    const { GET } = await importRoute();
    const response = await GET(
      makeGetRequest(
        "http://localhost/api/leads?page=2&pageSize=50&stage=new&q=barbearia",
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      data: [{ id: "lead-1", name: "X", tags: [] }],
      total: 137,
      page: 2,
      pageSize: 50,
      totalPages: 3,
    });

    expect(listLeadsMock).toHaveBeenCalledTimes(1);
    const arg = listLeadsMock.mock.calls[0]![0];
    expect(arg.params.page).toBe(2);
    expect(arg.params.pageSize).toBe(50);
    expect(arg.filters.stage).toBe("new");
    expect(arg.filters.q).toBe("barbearia");
  });

  it("retorna 502 com mensagem amigável em erro de Supabase", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    listLeadsMock.mockRejectedValue(new Error("PGRST116"));
    const { GET } = await importRoute();
    const response = await GET(makeGetRequest("http://localhost/api/leads"));
    expect(response.status).toBe(502);
  });
});

describe("POST /api/leads", () => {
  it("retorna 401 quando não autenticado", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { POST } = await importRoute();
    const response = await POST(
      makePostRequest({ name: "X", source: "google_maps" }),
    );
    expect(response.status).toBe(401);
  });

  it("retorna 400 quando body inválido", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { POST } = await importRoute();
    const response = await POST(makePostRequest({ name: "X" })); // sem source
    expect(response.status).toBe(400);
  });

  it("cria lead com user_id do request e retorna 201", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    createLeadMock.mockResolvedValue({
      id: "lead-1",
      name: "Novo",
      tags: [],
    });
    const { POST } = await importRoute();
    const response = await POST(
      makePostRequest({ name: "Novo", source: "google_maps" }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ id: "lead-1", name: "Novo" });

    expect(createLeadMock).toHaveBeenCalledTimes(1);
    expect(createLeadMock.mock.calls[0]![0].userId).toBe("user-1");
  });

  it("retorna 502 quando createLead falha", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    createLeadMock.mockRejectedValue(new Error("duplicate key"));
    const { POST } = await importRoute();
    const response = await POST(
      makePostRequest({ name: "Novo", source: "google_maps" }),
    );
    expect(response.status).toBe(502);
  });
});
