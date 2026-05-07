import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const dashboardMocks = vi.hoisted(() => ({
  getDashboardSummary: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/dashboard/summary", () => ({
  getDashboardSummary: dashboardMocks.getDashboardSummary,
}));

async function importRoute() {
  return import("@/app/api/dashboard/route");
}

beforeEach(() => {
  vi.resetModules();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  dashboardMocks.getDashboardSummary.mockReset();
  supabaseMocks.createServerSupabase.mockResolvedValue({
    auth: { getUser: supabaseMocks.getUser },
  });
});

describe("GET /api/dashboard", () => {
  it("retorna 401 quando não há usuário autenticado", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { GET } = await importRoute();
    const response = await GET();

    expect(response.status).toBe(401);
    expect(dashboardMocks.getDashboardSummary).not.toHaveBeenCalled();
  });

  it("retorna o resumo do dashboard para usuário autenticado", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    dashboardMocks.getDashboardSummary.mockResolvedValue({
      totalLeads: 10,
      newLeadsLast7Days: 3,
      leadsByStage: {
        new: 3,
        contacted: 2,
        in_conversation: 1,
        qualified: 1,
        closed_won: 2,
        closed_lost: 1,
      },
      recentSearches: [],
    });

    const { GET } = await importRoute();
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      totalLeads: 10,
      newLeadsLast7Days: 3,
    });
    expect(dashboardMocks.getDashboardSummary).toHaveBeenCalledTimes(1);
  });

  it("retorna 502 quando a query falha", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    dashboardMocks.getDashboardSummary.mockRejectedValue(new Error("PGRST"));

    const { GET } = await importRoute();
    const response = await GET();

    expect(response.status).toBe(502);
  });
});
