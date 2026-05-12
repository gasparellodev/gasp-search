import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const dashboardMocks = vi.hoisted(() => ({
  getDashboardSummary: vi.fn(),
  getSourceBreakdown: vi.fn(),
  getFunnelStats: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/dashboard/summary", () => ({
  getDashboardSummary: dashboardMocks.getDashboardSummary,
}));

vi.mock("@/lib/dashboard/insights", () => ({
  getSourceBreakdown: dashboardMocks.getSourceBreakdown,
  getFunnelStats: dashboardMocks.getFunnelStats,
}));

async function importRoute() {
  return import("@/app/api/dashboard/route");
}

beforeEach(() => {
  vi.resetModules();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  dashboardMocks.getDashboardSummary.mockReset();
  dashboardMocks.getSourceBreakdown.mockReset();
  dashboardMocks.getFunnelStats.mockReset();
  supabaseMocks.createServerSupabase.mockResolvedValue({
    auth: { getUser: supabaseMocks.getUser },
  });
  dashboardMocks.getSourceBreakdown.mockResolvedValue([]);
  dashboardMocks.getFunnelStats.mockResolvedValue([
    { stage: "new", count: 0, dropRate: null },
    { stage: "contacted", count: 0, dropRate: null },
    { stage: "in_conversation", count: 0, dropRate: null },
    { stage: "qualified", count: 0, dropRate: null },
    { stage: "closed_won", count: 0, dropRate: null },
  ]);
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

    dashboardMocks.getSourceBreakdown.mockResolvedValue([
      {
        source: "google_maps",
        total: 5,
        closedWon: 1,
        conversionRate: 0.2,
      },
    ]);
    dashboardMocks.getFunnelStats.mockResolvedValue([
      { stage: "new", count: 3, dropRate: null },
      { stage: "contacted", count: 2, dropRate: 1 / 3 },
      { stage: "in_conversation", count: 1, dropRate: 0.5 },
      { stage: "qualified", count: 1, dropRate: 0 },
      { stage: "closed_won", count: 2, dropRate: -1 },
    ]);

    const { GET } = await importRoute();
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      totalLeads: 10,
      newLeadsLast7Days: 3,
      sourceBreakdown: [
        {
          source: "google_maps",
          total: 5,
          closedWon: 1,
          conversionRate: 0.2,
        },
      ],
    });
    expect(body.funnel).toHaveLength(5);
    expect(dashboardMocks.getDashboardSummary).toHaveBeenCalledTimes(1);
    expect(dashboardMocks.getSourceBreakdown).toHaveBeenCalledTimes(1);
    expect(dashboardMocks.getFunnelStats).toHaveBeenCalledTimes(1);
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
