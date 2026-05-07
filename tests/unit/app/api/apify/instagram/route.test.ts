import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const runAndPersistMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/apify/run-and-persist", () => ({
  runAndPersist: runAndPersistMock,
}));

vi.mock("@/lib/env", () => ({
  env: {
    APIFY_INSTAGRAM_ACTOR_ID: "apify~instagram-scraper",
  },
}));

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
  runAndPersistMock.mockReset();
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
    const response = await POST(makeRequest({ search: "barbearia" }));
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

  it("dispara runAndPersist com mapper Instagram e responde 200", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    runAndPersistMock.mockResolvedValue({
      jobId: "job-ig-1",
      status: "succeeded",
      leadsCount: 12,
    });

    const { POST } = await importRoute();
    const response = await POST(
      makeRequest({ search: "barbearia", searchType: "user" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jobId: "job-ig-1",
      status: "succeeded",
      leadsCount: 12,
    });

    expect(runAndPersistMock).toHaveBeenCalledTimes(1);
    const arg = runAndPersistMock.mock.calls[0]![0];
    expect(arg.userId).toBe("user-1");
    expect(arg.source).toBe("instagram");
    expect(arg.actorId).toBe("apify~instagram-scraper");
    expect(typeof arg.mapper).toBe("function");
  });

  it("retorna 502 quando runAndPersist lança", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    runAndPersistMock.mockRejectedValue(new Error("apify down"));

    const { POST } = await importRoute();
    const response = await POST(makeRequest({ search: "barbearia" }));
    expect(response.status).toBe(502);
  });
});
