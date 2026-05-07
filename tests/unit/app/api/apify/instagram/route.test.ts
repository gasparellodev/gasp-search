import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const createSearchJobMock = vi.hoisted(() => vi.fn());
const executeSearchJobMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/apify/run-and-persist", () => ({
  createSearchJob: createSearchJobMock,
  executeSearchJob: executeSearchJobMock,
}));

vi.mock("@/lib/env", () => ({
  env: {
    APIFY_INSTAGRAM_ACTOR_ID: "apify~instagram-scraper",
  },
}));

// Mock `after` explicitly to execute synchronously for testing
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: vi.fn((callback) => {
      // For unit tests, we await the callback execution to observe side-effects
      void callback();
    }),
  };
});

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/apify/instagram", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function importRoute() {
  return import("@/app/api/apify/instagram/route");
}

beforeEach(() => {
  vi.resetModules();
  createSearchJobMock.mockReset();
  executeSearchJobMock.mockReset();

  createSearchJobMock.mockResolvedValue("job-ig-1");
  executeSearchJobMock.mockResolvedValue({
    jobId: "job-ig-1",
    status: "succeeded",
    leadsCount: 12,
  });

  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  supabaseMocks.createServerSupabase.mockResolvedValue({
    auth: { getUser: supabaseMocks.getUser },
  });
});

describe("POST /api/apify/instagram", () => {
  it("retorna 401 quando não há usuário autenticado", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ search: "barbearia", searchType: "user" }));
    expect(response.status).toBe(401);
  });

  it("retorna 400 quando body inválido (search ausente)", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
  });

  it("retorna 400 quando JSON malformado", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { POST } = await importRoute();
    const request = new Request(
      "http://localhost:3000/api/apify/instagram",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      },
    );
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("chama createSearchJob e retorna queued imediatamente, depois chama executeSearchJob em background", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const { POST } = await importRoute();
    const response = await POST(
      makeRequest({ search: "barbearia", searchType: "user" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jobId: "job-ig-1",
      status: "queued",
    });

    // Validar se createSearchJob foi chamado
    expect(createSearchJobMock).toHaveBeenCalledTimes(1);
    const createArg = createSearchJobMock.mock.calls[0]![0];
    expect(createArg.userId).toBe("user-1");
    expect(createArg.source).toBe("instagram");
    expect(createArg.input).toMatchObject({ search: "barbearia", searchType: "user" });

    // Validar se executeSearchJob foi chamado no background
    expect(executeSearchJobMock).toHaveBeenCalledTimes(1);
    const execArg = executeSearchJobMock.mock.calls[0]![0];
    expect(execArg.userId).toBe("user-1");
    expect(execArg.jobId).toBe("job-ig-1");
    expect(execArg.source).toBe("instagram");
    expect(execArg.actorId).toBe("apify~instagram-scraper");
    expect(typeof execArg.mapper).toBe("function");
  });

  it("retorna 502 quando createSearchJob lança erro", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    createSearchJobMock.mockRejectedValue(new Error("db down"));

    const { POST } = await importRoute();
    const response = await POST(makeRequest({ search: "barbearia", searchType: "user" }));
    expect(response.status).toBe(502);
    expect(executeSearchJobMock).not.toHaveBeenCalled();
  });
});
