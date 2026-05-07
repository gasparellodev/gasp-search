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
    APIFY_GOOGLE_MAPS_ACTOR_ID: "compass~crawler-google-places",
  },
}));

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/apify/google-maps", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function importRoute() {
  return import("@/app/api/apify/google-maps/route");
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

describe("POST /api/apify/google-maps", () => {
  it("retorna 401 quando não há usuário autenticado", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const { POST } = await importRoute();

    const response = await POST(
      makeRequest({ searchStringsArray: ["barbearia Curitiba PR"] }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Não autenticado",
    });
    expect(runAndPersistMock).not.toHaveBeenCalled();
  });

  it("retorna 400 com detalhes quando o body é inválido", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { POST } = await importRoute();

    const response = await POST(makeRequest({ searchStringsArray: [] }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toMatchObject({
      error: "Body inválido",
      issues: [
        expect.objectContaining({
          path: "searchStringsArray",
          message: expect.any(String),
        }),
      ],
    });
    expect(runAndPersistMock).not.toHaveBeenCalled();
  });

  it("chama runAndPersist e retorna payload de sucesso", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    runAndPersistMock.mockResolvedValue({
      jobId: "job-1",
      status: "succeeded",
      leadsCount: 3,
    });
    const { POST, maxDuration } = await importRoute();

    const response = await POST(
      makeRequest({
        searchStringsArray: ["barbearia Curitiba PR"],
        maxCrawledPlacesPerSearch: 25,
      }),
    );

    expect(maxDuration).toBe(300);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jobId: "job-1",
      status: "succeeded",
      leadsCount: 3,
    });
    expect(runAndPersistMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        source: "google_maps",
        actorId: "compass~crawler-google-places",
        input: expect.objectContaining({
          searchStringsArray: ["barbearia Curitiba PR"],
          maxCrawledPlacesPerSearch: 25,
        }),
        mapper: expect.any(Function),
      }),
    );
  });

  it("converte falha do actor em 502 amigável", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    runAndPersistMock.mockRejectedValue(new Error("actor explodiu"));
    const { POST } = await importRoute();

    const response = await POST(
      makeRequest({ searchStringsArray: ["barbearia Curitiba PR"] }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Falha ao executar busca no Google Maps. Tente novamente.",
    });
  });
});
