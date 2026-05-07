import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const enrichMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/apify/enrich", () => ({
  enrichLeadsByUrls: enrichMock,
}));

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/apify/enrich", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function importRoute() {
  return import("@/app/api/apify/enrich/route");
}

beforeEach(() => {
  vi.resetModules();
  enrichMock.mockReset();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
});

function setupSupabaseLeads(rows: Array<{ id: string; website: string | null }>) {
  const inFn = vi.fn(async () => ({ data: rows, error: null }));
  const select = vi.fn(() => ({ in: inFn }));
  const from = vi.fn(() => ({ select }));
  supabaseMocks.createServerSupabase.mockResolvedValue({
    auth: { getUser: supabaseMocks.getUser },
    from,
  });
  return { inFn, select, from };
}

describe("POST /api/apify/enrich", () => {
  it("401 sem auth", async () => {
    setupSupabaseLeads([]);
    supabaseMocks.getUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadIds: [UUID_A] }));
    expect(response.status).toBe(401);
  });

  it("400 quando body inválido (não-uuid)", async () => {
    setupSupabaseLeads([]);
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadIds: ["not-uuid"] }));
    expect(response.status).toBe(400);
  });

  it("400 quando passa do limite de 25", async () => {
    setupSupabaseLeads([]);
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    const tooMany = Array.from({ length: 26 }, (_, i) =>
      `${"a".repeat(8)}-${"a".repeat(4)}-4${"a".repeat(3)}-8${"a".repeat(3)}-${"a".repeat(11)}${i.toString().padStart(1, "0")}`
        .replace(/.{4}-.{4}-/, "aaaa-aaaa-")
        .slice(0, 36),
    );
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadIds: tooMany }));
    expect(response.status).toBe(400);
  });

  it("200 com enrichedCount e failedIds para leads sem website ou sem retorno", async () => {
    setupSupabaseLeads([
      { id: UUID_A, website: "bigode.com.br" },
      { id: UUID_B, website: "esteticamaria.com.br" },
      { id: UUID_C, website: null },
    ]);
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    enrichMock.mockResolvedValue({
      enrichedCount: 1,
      enrichedLeadIds: [UUID_A],
      skippedUrls: ["esteticamaria.com.br"],
    });

    const { POST } = await importRoute();
    const response = await POST(
      makeRequest({ leadIds: [UUID_A, UUID_B, UUID_C] }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      enrichedCount: number;
      failedIds: string[];
    };
    expect(body.enrichedCount).toBe(1);
    // UUID_B (website mas sem contato) e UUID_C (sem website) ambos failed
    expect(body.failedIds).toContain(UUID_B);
    expect(body.failedIds).toContain(UUID_C);
    expect(body.failedIds).not.toContain(UUID_A);

    expect(enrichMock).toHaveBeenCalledTimes(1);
    const arg = enrichMock.mock.calls[0]![0];
    expect(arg.userId).toBe("user-1");
    expect(arg.urls).toEqual(["bigode.com.br", "esteticamaria.com.br"]);
  });

  it("200 com todos failedIds quando nenhum lead tem website", async () => {
    setupSupabaseLeads([
      { id: UUID_A, website: null },
      { id: UUID_B, website: null },
    ]);
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadIds: [UUID_A, UUID_B] }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      enrichedCount: number;
      failedIds: string[];
    };
    expect(body.enrichedCount).toBe(0);
    expect(body.failedIds).toEqual([UUID_A, UUID_B]);
    // Nem chamou Apify (urls vazio)
    expect(enrichMock).not.toHaveBeenCalled();
  });

  it("502 quando enrich lança", async () => {
    setupSupabaseLeads([{ id: UUID_A, website: "bigode.com.br" }]);
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    enrichMock.mockRejectedValue(new Error("apify"));

    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadIds: [UUID_A] }));
    expect(response.status).toBe(502);
  });

  it("404 quando leads passados não pertencem ao user (RLS retorna vazio)", async () => {
    setupSupabaseLeads([]); // RLS bloqueia → nenhum row
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadIds: [UUID_A] }));
    expect(response.status).toBe(404);
  });
});
