import { describe, expect, it, vi } from "vitest";
import {
  getFunnelStats,
  getSourceBreakdown,
} from "@/lib/dashboard/insights";

type QueryResult = {
  data: unknown;
  count: number | null;
  error: { message: string } | null;
};

function createSupabaseMock(
  rows: Array<{ source: string; stage: string }>,
  error: { message: string } | null = null,
) {
  const result: QueryResult = {
    data: error ? null : rows,
    count: error ? null : rows.length,
    error,
  };
  const select = vi.fn(async () => result);
  const from = vi.fn(() => ({ select }));
  return {
    client: {
      from,
    } as unknown as Parameters<typeof getSourceBreakdown>[0]["supabase"],
    spies: { from, select },
  };
}

describe("getSourceBreakdown", () => {
  it("agrupa leads por source com total, closedWon e conversionRate", async () => {
    const { client, spies } = createSupabaseMock([
      { source: "google_maps", stage: "new" },
      { source: "google_maps", stage: "contacted" },
      { source: "google_maps", stage: "closed_won" },
      { source: "google_maps", stage: "closed_won" },
      { source: "instagram", stage: "qualified" },
      { source: "instagram", stage: "closed_won" },
      { source: "website_contact", stage: "in_conversation" },
    ]);

    const result = await getSourceBreakdown({ supabase: client });

    expect(spies.from).toHaveBeenCalledWith("leads");
    expect(spies.select).toHaveBeenCalledWith("source, stage");

    expect(result).toEqual(
      expect.arrayContaining([
        {
          source: "google_maps",
          total: 4,
          closedWon: 2,
          conversionRate: 0.5,
        },
        {
          source: "instagram",
          total: 2,
          closedWon: 1,
          conversionRate: 0.5,
        },
        {
          source: "website_contact",
          total: 1,
          closedWon: 0,
          conversionRate: 0,
        },
      ]),
    );
    expect(result).toHaveLength(3);
  });

  it("ordena por total desc e desempata por source asc", async () => {
    const { client } = createSupabaseMock([
      { source: "instagram", stage: "new" },
      { source: "instagram", stage: "new" },
      { source: "instagram", stage: "new" },
      { source: "google_maps", stage: "new" },
      { source: "google_maps", stage: "new" },
      { source: "google_maps", stage: "new" },
      { source: "website_contact", stage: "new" },
    ]);

    const result = await getSourceBreakdown({ supabase: client });

    expect(result.map((row) => row.source)).toEqual([
      "google_maps",
      "instagram",
      "website_contact",
    ]);
  });

  it("retorna lista vazia quando não há leads", async () => {
    const { client } = createSupabaseMock([]);
    const result = await getSourceBreakdown({ supabase: client });
    expect(result).toEqual([]);
  });

  it("ignora rows com source desconhecido", async () => {
    const { client } = createSupabaseMock([
      { source: "google_maps", stage: "new" },
      { source: "unknown_source", stage: "closed_won" },
    ]);

    const result = await getSourceBreakdown({ supabase: client });
    expect(result).toEqual([
      {
        source: "google_maps",
        total: 1,
        closedWon: 0,
        conversionRate: 0,
      },
    ]);
  });

  it("lança erro com prefixo amigável quando query falha", async () => {
    const { client } = createSupabaseMock([], { message: "PGRST116" });
    await expect(
      getSourceBreakdown({ supabase: client }),
    ).rejects.toThrow(/Falha ao carregar dashboard/);
  });
});

describe("getFunnelStats", () => {
  it("retorna 5 estágios com count e dropRate entre etapas", async () => {
    const rows: Array<{ source: string; stage: string }> = [];
    const distribution: Array<[string, number]> = [
      ["new", 100],
      ["contacted", 80],
      ["in_conversation", 60],
      ["qualified", 40],
      ["closed_won", 30],
      ["closed_lost", 10],
    ];
    for (const [stage, n] of distribution) {
      for (let i = 0; i < n; i += 1) {
        rows.push({ source: "google_maps", stage });
      }
    }
    const { client, spies } = createSupabaseMock(rows);

    const result = await getFunnelStats({ supabase: client });

    expect(spies.from).toHaveBeenCalledWith("leads");
    expect(spies.select).toHaveBeenCalledWith("source, stage");

    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ stage: "new", count: 100, dropRate: null });
    expect(result[1]).toEqual({
      stage: "contacted",
      count: 80,
      dropRate: 0.2,
    });
    expect(result[2]).toEqual({
      stage: "in_conversation",
      count: 60,
      dropRate: 0.25,
    });
    expect(result[3]).toMatchObject({
      stage: "qualified",
      count: 40,
    });
    expect(result[3]!.dropRate).toBeCloseTo(1 / 3, 6);
    expect(result[4]).toEqual({
      stage: "closed_won",
      count: 30,
      dropRate: 0.25,
    });
  });

  it("dropRate é null quando o estágio anterior tem zero leads", async () => {
    const { client } = createSupabaseMock([
      { source: "google_maps", stage: "closed_won" },
      { source: "google_maps", stage: "closed_won" },
    ]);

    const result = await getFunnelStats({ supabase: client });

    expect(result).toEqual([
      { stage: "new", count: 0, dropRate: null },
      { stage: "contacted", count: 0, dropRate: null },
      { stage: "in_conversation", count: 0, dropRate: null },
      { stage: "qualified", count: 0, dropRate: null },
      { stage: "closed_won", count: 2, dropRate: null },
    ]);
  });

  it("retorna 5 estágios zerados quando não há leads", async () => {
    const { client } = createSupabaseMock([]);
    const result = await getFunnelStats({ supabase: client });
    expect(result).toEqual([
      { stage: "new", count: 0, dropRate: null },
      { stage: "contacted", count: 0, dropRate: null },
      { stage: "in_conversation", count: 0, dropRate: null },
      { stage: "qualified", count: 0, dropRate: null },
      { stage: "closed_won", count: 0, dropRate: null },
    ]);
  });

  it("lança erro com prefixo amigável quando query falha", async () => {
    const { client } = createSupabaseMock([], { message: "boom" });
    await expect(
      getFunnelStats({ supabase: client }),
    ).rejects.toThrow(/Falha ao carregar dashboard/);
  });
});
