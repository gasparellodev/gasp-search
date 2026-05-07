import { describe, expect, it, vi } from "vitest";
import { createTag, deleteTag, updateTag } from "@/lib/leads/tags-crud";

const baseTag = {
  id: "tag-1",
  user_id: "user-1",
  name: "Quente",
  color: "#ef4444",
  created_at: "2026-05-07T00:00:00Z",
};

function createSupabaseStub() {
  const single = vi.fn();
  const select = vi.fn(() => chain);
  const eq = vi.fn(() => chain);
  const insert = vi.fn(() => chain);
  const update = vi.fn(() => chain);
  const del = vi.fn(() => chain);

  const chain: Record<string, unknown> = {
    select,
    eq,
    insert,
    update,
    delete: del,
    single,
  };
  const from = vi.fn(() => chain);
  return {
    client: { from } as unknown as Parameters<typeof createTag>[0]["supabase"],
    spies: { from, select, eq, insert, update, delete: del, single },
  };
}

describe("createTag", () => {
  it("insere tag com user_id e retorna row", async () => {
    const { client, spies } = createSupabaseStub();
    spies.single.mockResolvedValueOnce({ data: baseTag, error: null });
    const result = await createTag({
      supabase: client,
      userId: "user-1",
      input: { name: "Quente", color: "#ef4444" },
    });
    expect(spies.from).toHaveBeenCalledWith("tags");
    expect(spies.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      name: "Quente",
      color: "#ef4444",
    });
    expect(result).toEqual(baseTag);
  });

  it("lança erro de conflito quando nome duplicado (Postgres 23505)", async () => {
    const { client, spies } = createSupabaseStub();
    spies.single.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    await expect(
      createTag({
        supabase: client,
        userId: "user-1",
        input: { name: "Quente", color: "#ef4444" },
      }),
    ).rejects.toThrow(/já existe/i);
  });

  it("lança erro genérico em outras falhas", async () => {
    const { client, spies } = createSupabaseStub();
    spies.single.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "rls" },
    });
    await expect(
      createTag({
        supabase: client,
        userId: "user-1",
        input: { name: "Quente", color: "#ef4444" },
      }),
    ).rejects.toThrow(/rls/);
  });
});

describe("updateTag", () => {
  it("atualiza tag e retorna row", async () => {
    const { client, spies } = createSupabaseStub();
    spies.single.mockResolvedValueOnce({
      data: { ...baseTag, name: "Quentíssimo" },
      error: null,
    });
    const result = await updateTag({
      supabase: client,
      id: "tag-1",
      input: { name: "Quentíssimo" },
    });
    expect(spies.update).toHaveBeenCalledWith({ name: "Quentíssimo" });
    expect(spies.eq).toHaveBeenCalledWith("id", "tag-1");
    expect(result?.name).toBe("Quentíssimo");
  });

  it("retorna null quando RLS bloqueia (sem rows)", async () => {
    const { client, spies } = createSupabaseStub();
    spies.single.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });
    const result = await updateTag({
      supabase: client,
      id: "missing",
      input: { name: "X" },
    });
    expect(result).toBeNull();
  });
});

describe("deleteTag", () => {
  it("retorna true quando 1 row deletada", async () => {
    const { client, spies, chain } = (() => {
      const stub = createSupabaseStub();
      Object.assign(stub.spies as unknown as Record<string, unknown>, {});
      return { ...stub, chain: undefined };
    })();
    void chain;
    // Substituir eq para retornar Promise direta
    (spies.delete as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      eq: vi.fn(async () => ({ data: null, count: 1, error: null })),
    }));
    const result = await deleteTag({ supabase: client, id: "tag-1" });
    expect(result).toBe(true);
  });

  it("retorna false quando 0 rows", async () => {
    const { client, spies } = createSupabaseStub();
    (spies.delete as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      eq: vi.fn(async () => ({ data: null, count: 0, error: null })),
    }));
    const result = await deleteTag({ supabase: client, id: "x" });
    expect(result).toBe(false);
  });
});
