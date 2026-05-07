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

const autoEnrichMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apify/auto-enrich", () => ({
  autoEnrichGoogleMapsJob: autoEnrichMock,
}));

vi.mock("@/lib/env", () => ({
  env: {
    APIFY_GOOGLE_MAPS_ACTOR_ID: "compass~crawler-google-places",
    AUTO_ENRICH_AFTER_GMAPS: true,
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
  createSearchJobMock.mockReset();
  executeSearchJobMock.mockReset();
  autoEnrichMock.mockReset();

  createSearchJobMock.mockResolvedValue("job-1");
  executeSearchJobMock.mockResolvedValue({
    jobId: "job-1",
    status: "succeeded",
    leadsCount: 3,
  });
  autoEnrichMock.mockResolvedValue({
    enrichedCount: 0,
    enrichedLeadIds: [],
  });

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
    expect(createSearchJobMock).not.toHaveBeenCalled();
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
    expect(createSearchJobMock).not.toHaveBeenCalled();
  });

  it("chama createSearchJob e retorna queued imediatamente, depois chama executeSearchJob em background", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { POST } = await importRoute();

    const response = await POST(
      makeRequest({
        searchStringsArray: ["barbearia Curitiba PR"],
        maxCrawledPlacesPerSearch: 25,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jobId: "job-1",
      status: "queued",
    });

    expect(createSearchJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        source: "google_maps",
        input: expect.objectContaining({
          searchStringsArray: ["barbearia Curitiba PR"],
          maxCrawledPlacesPerSearch: 25,
        }),
      }),
    );

    // Verificamos o background execution
    expect(executeSearchJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        jobId: "job-1",
        actorId: "compass~crawler-google-places",
      })
    );
  });

  it("retorna 502 se createSearchJob falhar (falha de banco)", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    createSearchJobMock.mockRejectedValue(new Error("db failure"));
    const { POST } = await importRoute();

    const response = await POST(
      makeRequest({ searchStringsArray: ["barbearia Curitiba PR"] }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Falha ao criar busca no Google Maps. Tente novamente.",
    });
  });

  it("dispara autoEnrich no background após executeSearchJob com sucesso", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    // Config do mock garante que o after executa
    const { POST } = await importRoute();
    const response = await POST(
      makeRequest({ searchStringsArray: ["barbearia Curitiba PR"] }),
    );

    expect(response.status).toBe(200);

    // Asserções do workflow no background
    expect(autoEnrichMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", jobId: "job-1" }),
    );
  });

  it("não dispara autoEnrich se executeSearchJob retornar failed no background", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    executeSearchJobMock.mockResolvedValue({
      jobId: "job-1",
      status: "failed",
      leadsCount: 0,
    });

    const { POST } = await importRoute();
    await POST(
      makeRequest({ searchStringsArray: ["barbearia Curitiba PR"] }),
    );
    expect(autoEnrichMock).not.toHaveBeenCalled();
  });
});
