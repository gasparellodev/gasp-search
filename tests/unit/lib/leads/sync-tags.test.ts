import { describe, expect, it, vi } from "vitest";
import { syncLeadTags } from "@/lib/leads/crud";

type Result<T> = { data: T; error: { message: string } | null };

function createSupabaseStub(opts: {
  current?: Array<{ tag_id: string }>;
  deleteResult?: Result<unknown>;
  insertResult?: Result<unknown>;
  selectError?: { message: string } | null;
}) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];

  // SELECT lead_tags chain: from("lead_tags").select("tag_id").eq("lead_id", id)
  const selectEq = vi.fn(async () => ({
    data: opts.current ?? [],
    error: opts.selectError ?? null,
  }));
  const select = vi.fn(() => ({ eq: selectEq }));

  // DELETE chain: from("lead_tags").delete().eq("lead_id", id).in("tag_id", [...])
  const deleteIn = vi.fn(
    async () => opts.deleteResult ?? { data: null, error: null },
  );
  const deleteEq = vi.fn(() => ({ in: deleteIn }));
  const del = vi.fn(() => ({ eq: deleteEq }));

  // INSERT chain: from("lead_tags").insert([...])
  type InsertRow = { lead_id: string; tag_id: string };
  const insert = vi.fn<(rows: InsertRow[]) => Promise<Result<unknown>>>(
    async () => opts.insertResult ?? { data: null, error: null },
  );

  const from = vi.fn((table: string) => {
    calls.push({ table, method: "from", args: [] });
    return {
      select,
      delete: del,
      insert,
    };
  });

  return {
    client: { from } as unknown as Parameters<typeof syncLeadTags>[0]["supabase"],
    spies: { from, select, selectEq, delete: del, deleteEq, deleteIn, insert },
  };
}

describe("syncLeadTags", () => {
  it("sem mudanças quando current === target", async () => {
    const { client, spies } = createSupabaseStub({
      current: [{ tag_id: "a" }, { tag_id: "b" }],
    });
    await syncLeadTags({
      supabase: client,
      leadId: "lead-1",
      tagIds: ["a", "b"],
    });
    expect(spies.deleteIn).not.toHaveBeenCalled();
    expect(spies.insert).not.toHaveBeenCalled();
  });

  it("remove tags que saíram e insere as novas", async () => {
    const { client, spies } = createSupabaseStub({
      current: [{ tag_id: "a" }, { tag_id: "b" }],
    });
    await syncLeadTags({
      supabase: client,
      leadId: "lead-1",
      tagIds: ["b", "c"],
    });
    expect(spies.deleteEq).toHaveBeenCalledWith("lead_id", "lead-1");
    expect(spies.deleteIn).toHaveBeenCalledWith("tag_id", ["a"]);
    expect(spies.insert).toHaveBeenCalledTimes(1);
    const insertedRows = spies.insert.mock.calls[0]?.[0];
    expect(insertedRows).toEqual([{ lead_id: "lead-1", tag_id: "c" }]);
  });

  it("array vazio remove todas as tags atuais", async () => {
    const { client, spies } = createSupabaseStub({
      current: [{ tag_id: "a" }],
    });
    await syncLeadTags({
      supabase: client,
      leadId: "lead-1",
      tagIds: [],
    });
    expect(spies.deleteIn).toHaveBeenCalledWith("tag_id", ["a"]);
    expect(spies.insert).not.toHaveBeenCalled();
  });

  it("lança erro se o select falha", async () => {
    const { client } = createSupabaseStub({
      selectError: { message: "boom" },
    });
    await expect(
      syncLeadTags({
        supabase: client,
        leadId: "lead-1",
        tagIds: ["a"],
      }),
    ).rejects.toThrow(/boom/);
  });

  it("lança erro se o delete falha", async () => {
    const { client } = createSupabaseStub({
      current: [{ tag_id: "a" }],
      deleteResult: { data: null, error: { message: "del" } },
    });
    await expect(
      syncLeadTags({
        supabase: client,
        leadId: "lead-1",
        tagIds: [],
      }),
    ).rejects.toThrow(/del/);
  });

  it("lança erro se o insert falha", async () => {
    const { client } = createSupabaseStub({
      current: [],
      insertResult: { data: null, error: { message: "ins" } },
    });
    await expect(
      syncLeadTags({
        supabase: client,
        leadId: "lead-1",
        tagIds: ["new"],
      }),
    ).rejects.toThrow(/ins/);
  });
});
