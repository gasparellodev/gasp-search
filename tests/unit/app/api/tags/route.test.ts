import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const listTagsMock = vi.hoisted(() => vi.fn());
const createTagMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/leads/list-tags", () => ({
  listTags: listTagsMock,
}));

vi.mock("@/lib/leads/tags-crud", async () => {
  const actual = await vi.importActual<typeof import("@/lib/leads/tags-crud")>(
    "@/lib/leads/tags-crud",
  );
  return {
    ...actual,
    createTag: createTagMock,
    updateTag: vi.fn(),
    deleteTag: vi.fn(),
  };
});

async function importRoute() {
  return import("@/app/api/tags/route");
}

beforeEach(() => {
  vi.resetModules();
  listTagsMock.mockReset();
  createTagMock.mockReset();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  supabaseMocks.createServerSupabase.mockResolvedValue({
    auth: { getUser: supabaseMocks.getUser },
  });
});

describe("GET /api/tags", () => {
  it("401 sem auth", async () => {
    supabaseMocks.getUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await importRoute();
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("200 com lista", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    listTagsMock.mockResolvedValue([
      { id: "tag-1", name: "Quente", color: "#f00" },
    ]);
    const { GET } = await importRoute();
    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
});

describe("POST /api/tags", () => {
  it("401 sem auth", async () => {
    supabaseMocks.getUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("400 com body inválido (name muito curto)", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "u" } },
    });
    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("201 com tag criada", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    createTagMock.mockResolvedValue({
      id: "tag-1",
      name: "Quente",
      color: "#ef4444",
      user_id: "user-1",
      created_at: "2026-05-07T00:00:00Z",
    });
    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Quente", color: "#ef4444" }),
      }),
    );
    expect(response.status).toBe(201);
    expect(createTagMock).toHaveBeenCalledWith({
      supabase: expect.anything(),
      userId: "user-1",
      input: expect.objectContaining({ name: "Quente", color: "#ef4444" }),
    });
  });

  it("409 quando duplicate", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    const { DuplicateTagError } = await import("@/lib/leads/tags-crud");
    createTagMock.mockRejectedValue(new DuplicateTagError());
    const { POST } = await importRoute();
    const response = await POST(
      new Request("http://localhost/api/tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Quente" }),
      }),
    );
    expect(response.status).toBe(409);
  });
});
