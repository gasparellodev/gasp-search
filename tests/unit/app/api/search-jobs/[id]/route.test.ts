import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

function makeRequest(id: string) {
  return new Request(`http://localhost:3000/api/search-jobs/${id}`);
}

async function importRoute() {
  return import("@/app/api/search-jobs/[id]/route");
}

beforeEach(() => {
  vi.resetModules();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.from.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  supabaseMocks.createServerSupabase.mockResolvedValue({
    auth: { getUser: supabaseMocks.getUser },
    from: supabaseMocks.from,
  });
});

describe("GET /api/search-jobs/[id]", () => {
  it("retorna 401 quando não autenticado", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { GET } = await importRoute();

    const response = await GET(makeRequest("job-1"), {
      params: Promise.resolve({ id: "job-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("retorna 404 quando job não é encontrado", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const eqMock = vi.fn().mockReturnValue({
      single: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "not found" } }),
    });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    supabaseMocks.from.mockReturnValue({ select: selectMock });

    const { GET } = await importRoute();

    const response = await GET(makeRequest("job-1"), {
      params: Promise.resolve({ id: "job-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("retorna 200 com os dados do job", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const mockJob = { id: "job-1", status: "succeeded", results_count: 5 };
    const eqMock = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
    });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    supabaseMocks.from.mockReturnValue({ select: selectMock });

    const { GET } = await importRoute();

    const response = await GET(makeRequest("job-1"), {
      params: Promise.resolve({ id: "job-1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual(mockJob);
    expect(supabaseMocks.from).toHaveBeenCalledWith("search_jobs");
    expect(selectMock).toHaveBeenCalledWith(expect.stringContaining("status"));
    expect(eqMock).toHaveBeenCalledWith("id", "job-1");
  });
});
