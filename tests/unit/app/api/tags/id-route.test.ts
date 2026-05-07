import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const updateTagMock = vi.hoisted(() => vi.fn());
const deleteTagMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/leads/tags-crud", async () => {
  const actual = await vi.importActual<typeof import("@/lib/leads/tags-crud")>(
    "@/lib/leads/tags-crud",
  );
  return {
    ...actual,
    updateTag: updateTagMock,
    deleteTag: deleteTagMock,
    createTag: vi.fn(),
  };
});

async function importRoute() {
  return import("@/app/api/tags/[id]/route");
}

const ctx = { params: Promise.resolve({ id: "tag-1" }) };

function makeRequest(method: string, body?: unknown) {
  return new Request("http://localhost:3000/api/tags/tag-1", {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.resetModules();
  updateTagMock.mockReset();
  deleteTagMock.mockReset();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  supabaseMocks.createServerSupabase.mockResolvedValue({
    auth: { getUser: supabaseMocks.getUser },
  });
});

describe("PATCH /api/tags/[id]", () => {
  it("401 sem auth", async () => {
    supabaseMocks.getUser.mockResolvedValue({ data: { user: null } });
    const { PATCH } = await importRoute();
    const response = await PATCH(makeRequest("PATCH", { name: "X" }), ctx);
    expect(response.status).toBe(401);
  });

  it("400 com body inválido", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u" } },
    });
    const { PATCH } = await importRoute();
    const response = await PATCH(makeRequest("PATCH", {}), ctx);
    expect(response.status).toBe(400);
  });

  it("404 quando RLS bloqueia", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u" } },
    });
    updateTagMock.mockResolvedValue(null);
    const { PATCH } = await importRoute();
    const response = await PATCH(makeRequest("PATCH", { name: "Yummy" }), ctx);
    expect(response.status).toBe(404);
  });

  it("200 com tag atualizada", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u" } },
    });
    updateTagMock.mockResolvedValue({
      id: "tag-1",
      name: "Y",
      color: "#000000",
    });
    const { PATCH } = await importRoute();
    const response = await PATCH(makeRequest("PATCH", { name: "Yummy" }), ctx);
    expect(response.status).toBe(200);
  });
});

describe("DELETE /api/tags/[id]", () => {
  it("401 sem auth", async () => {
    supabaseMocks.getUser.mockResolvedValue({ data: { user: null } });
    const { DELETE } = await importRoute();
    const response = await DELETE(makeRequest("DELETE"), ctx);
    expect(response.status).toBe(401);
  });

  it("404 quando 0 rows", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u" } },
    });
    deleteTagMock.mockResolvedValue(false);
    const { DELETE } = await importRoute();
    const response = await DELETE(makeRequest("DELETE"), ctx);
    expect(response.status).toBe(404);
  });

  it("204 quando deletado", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u" } },
    });
    deleteTagMock.mockResolvedValue(true);
    const { DELETE } = await importRoute();
    const response = await DELETE(makeRequest("DELETE"), ctx);
    expect(response.status).toBe(204);
  });
});
