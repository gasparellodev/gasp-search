import { describe, expect, it, vi } from "vitest";
import { listTags } from "@/lib/leads/list-tags";

function createSupabaseStub(result: {
  data: unknown;
  error: { message: string } | null;
}) {
  const order = vi.fn(async () => result);
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { from } as unknown as Parameters<typeof listTags>[0]["supabase"],
    spies: { from, select, order },
  };
}

describe("listTags", () => {
  it("retorna tags ordenadas por name asc", async () => {
    const { client, spies } = createSupabaseStub({
      data: [
        { id: "tag-2", name: "Quente", color: "#f00" },
        { id: "tag-1", name: "Frio", color: "#0ea5e9" },
      ],
      error: null,
    });
    const result = await listTags({ supabase: client });

    expect(spies.from).toHaveBeenCalledWith("tags");
    expect(spies.select).toHaveBeenCalledWith("id, name, color");
    expect(spies.order).toHaveBeenCalledWith("name", { ascending: true });
    expect(result).toEqual([
      { id: "tag-2", name: "Quente", color: "#f00" },
      { id: "tag-1", name: "Frio", color: "#0ea5e9" },
    ]);
  });

  it("retorna [] quando supabase retorna data null", async () => {
    const { client } = createSupabaseStub({ data: null, error: null });
    const result = await listTags({ supabase: client });
    expect(result).toEqual([]);
  });

  it("lança erro em falha do supabase", async () => {
    const { client } = createSupabaseStub({
      data: null,
      error: { message: "boom" },
    });
    await expect(listTags({ supabase: client })).rejects.toThrow(/boom/);
  });
});
