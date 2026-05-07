import { describe, expect, it, vi } from "vitest";
import { getDashboardSummary } from "@/lib/dashboard/summary";

type QueryResult = {
  data: unknown;
  count: number | null;
  error: { message: string } | null;
};

function createSupabaseMock({
  totalLeads = 42,
  newLeads = 7,
  stageRows = [
    { stage: "new" },
    { stage: "new" },
    { stage: "contacted" },
    { stage: "qualified" },
  ],
  recentSearches = [
    {
      id: "job-1",
      source: "google_maps",
      status: "succeeded",
      results_count: 12,
      error_message: null,
      created_at: "2026-05-07T12:00:00Z",
      finished_at: "2026-05-07T12:01:00Z",
    },
  ],
  error = null,
}: {
  totalLeads?: number;
  newLeads?: number;
  stageRows?: Array<{ stage: string }>;
  recentSearches?: unknown[];
  error?: { message: string } | null;
} = {}) {
  const totalResult: QueryResult = { data: null, count: totalLeads, error };
  const newResult: QueryResult = { data: null, count: newLeads, error };
  const stageResult: QueryResult = {
    data: stageRows,
    count: stageRows.length,
    error,
  };
  const searchResult: QueryResult = {
    data: recentSearches,
    count: recentSearches.length,
    error,
  };

  const gte = vi.fn(async () => newResult);
  const limit = vi.fn(async () => searchResult);
  const order = vi.fn(() => ({ limit }));
  const leadSelect = vi
    .fn()
    .mockReturnValueOnce(Promise.resolve(totalResult))
    .mockReturnValueOnce({ gte })
    .mockReturnValueOnce(Promise.resolve(stageResult));
  const searchSelect = vi.fn(() => ({ order }));
  const from = vi.fn((table: string) => {
    if (table === "leads") return { select: leadSelect };
    if (table === "search_jobs") return { select: searchSelect };
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    client: {
      from,
    } as unknown as Parameters<typeof getDashboardSummary>[0]["supabase"],
    spies: { from, leadSelect, gte, searchSelect, order, limit },
  };
}

describe("getDashboardSummary", () => {
  it("calcula total, novos 7d, contagem por estágio e últimas 5 buscas", async () => {
    const { client, spies } = createSupabaseMock();

    const result = await getDashboardSummary({
      supabase: client,
      now: new Date("2026-05-07T15:00:00Z"),
    });

    expect(spies.leadSelect).toHaveBeenNthCalledWith(1, "id", {
      count: "exact",
      head: true,
    });
    expect(spies.leadSelect).toHaveBeenNthCalledWith(2, "id", {
      count: "exact",
      head: true,
    });
    expect(spies.gte).toHaveBeenCalledWith(
      "created_at",
      "2026-04-30T15:00:00.000Z",
    );
    expect(spies.leadSelect).toHaveBeenNthCalledWith(3, "stage");
    expect(spies.searchSelect).toHaveBeenCalledWith(
      "id, source, status, results_count, error_message, created_at, finished_at",
    );
    expect(spies.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(spies.limit).toHaveBeenCalledWith(5);

    expect(result).toMatchObject({
      totalLeads: 42,
      newLeadsLast7Days: 7,
      leadsByStage: {
        new: 2,
        contacted: 1,
        in_conversation: 0,
        qualified: 1,
        closed_won: 0,
        closed_lost: 0,
      },
      recentSearches: [
        {
          id: "job-1",
          source: "google_maps",
          status: "succeeded",
          resultsCount: 12,
        },
      ],
    });
  });

  it("lança erro em português quando uma query falha", async () => {
    const { client } = createSupabaseMock({
      error: { message: "PGRST116" },
    });

    await expect(
      getDashboardSummary({
        supabase: client,
        now: new Date("2026-05-07T15:00:00Z"),
      }),
    ).rejects.toThrow("Falha ao carregar dashboard");
  });
});
