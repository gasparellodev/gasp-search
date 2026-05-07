import { describe, expect, it, vi } from "vitest";
import { listLeadsByStage } from "@/lib/leads/list-by-stage";

function createSupabaseStub(rows: unknown, error: { message: string } | null = null) {
  const order = vi.fn(async () => ({ data: rows, error }));
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { from } as unknown as Parameters<
      typeof listLeadsByStage
    >[0]["supabase"],
    spies: { from, select, order },
  };
}

describe("listLeadsByStage", () => {
  it("agrupa leads pelos seis estágios e retorna mapa estável", async () => {
    const rows = [
      { id: "lead-1", name: "A", stage: "new", score: 0, tags: [] },
      { id: "lead-2", name: "B", stage: "contacted", score: 10, tags: [] },
      { id: "lead-3", name: "C", stage: "new", score: 5, tags: [] },
    ];
    const { client, spies } = createSupabaseStub(rows);

    const result = await listLeadsByStage({ supabase: client });

    expect(spies.from).toHaveBeenCalledWith("leads");
    expect(spies.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });

    expect(Object.keys(result)).toEqual([
      "new",
      "contacted",
      "in_conversation",
      "qualified",
      "closed_won",
      "closed_lost",
    ]);
    expect(result.new).toHaveLength(2);
    expect(result.contacted).toHaveLength(1);
    expect(result.in_conversation).toEqual([]);
    expect(result.closed_won).toEqual([]);
  });

  it("retorna mapa vazio (todos os estágios = []) quando data null", async () => {
    const { client } = createSupabaseStub(null);
    const result = await listLeadsByStage({ supabase: client });
    expect(result.new).toEqual([]);
    expect(result.closed_lost).toEqual([]);
  });

  it("lança erro quando supabase falha", async () => {
    const { client } = createSupabaseStub(null, { message: "rls" });
    await expect(
      listLeadsByStage({ supabase: client }),
    ).rejects.toThrow(/rls/);
  });
});
