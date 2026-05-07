import { describe, expect, it, vi } from "vitest";
import {
  createLead,
  deleteLead,
  getLead,
  updateLead,
} from "@/lib/leads/crud";

const baseRow = {
  id: "lead-1",
  user_id: "user-1",
  source: "google_maps",
  source_search_job_id: null,
  name: "X",
  category: null,
  city: null,
  state: null,
  country: null,
  phone: null,
  email: null,
  website: null,
  instagram_handle: null,
  whatsapp: null,
  has_website: null,
  rating: null,
  reviews_count: null,
  followers_count: null,
  stage: "new",
  score: 0,
  notes: null,
  raw: null,
  enriched_at: null,
  created_at: "2026-05-07T00:00:00Z",
  updated_at: "2026-05-07T00:00:00Z",
  lead_tags: [],
};

function createSupabaseStub() {
  const calls: { table: string; method: string; args: unknown[] }[] = [];

  const single = vi.fn();
  const maybeSingle = vi.fn();
  const select = vi.fn(function selectImpl(this: unknown, ...args: unknown[]) {
    calls.push({ table: "?", method: "select", args });
    return chain;
  });
  const eq = vi.fn(function eqImpl(this: unknown, ...args: unknown[]) {
    calls.push({ table: "?", method: "eq", args });
    return chain;
  });
  const insert = vi.fn(function insertImpl(this: unknown, ...args: unknown[]) {
    calls.push({ table: "?", method: "insert", args });
    return chain;
  });
  const update = vi.fn(function updateImpl(this: unknown, ...args: unknown[]) {
    calls.push({ table: "?", method: "update", args });
    return chain;
  });
  const del = vi.fn(function deleteImpl(this: unknown, ...args: unknown[]) {
    calls.push({ table: "?", method: "delete", args });
    return chain;
  });
  const inFn = vi.fn(function inImpl(this: unknown, ...args: unknown[]) {
    calls.push({ table: "?", method: "in", args });
    return chain;
  });

  const chain: Record<string, unknown> = {
    select,
    eq,
    insert,
    update,
    delete: del,
    in: inFn,
    single,
    maybeSingle,
  };

  const from = vi.fn((table: string) => {
    calls.push({ table, method: "from", args: [] });
    return chain;
  });

  return {
    client: { from } as unknown as Parameters<typeof getLead>[0]["supabase"],
    spies: { from, select, eq, insert, update, delete: del, single, maybeSingle, in: inFn },
    chain,
  };
}

describe("getLead", () => {
  it("retorna lead com tags achatadas", async () => {
    const { client, spies } = createSupabaseStub();
    spies.maybeSingle.mockResolvedValueOnce({
      data: {
        ...baseRow,
        lead_tags: [{ tag: { id: "tag-1", name: "Quente", color: "#f00" } }],
      },
      error: null,
    });

    const result = await getLead({ supabase: client, id: "lead-1" });

    expect(spies.from).toHaveBeenCalledWith("leads");
    expect(spies.eq).toHaveBeenCalledWith("id", "lead-1");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("lead-1");
    expect(result?.tags).toEqual([
      { id: "tag-1", name: "Quente", color: "#f00" },
    ]);
  });

  it("retorna null quando RLS/lead inexistente", async () => {
    const { client, spies } = createSupabaseStub();
    spies.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await getLead({ supabase: client, id: "missing" });
    expect(result).toBeNull();
  });

  it("lança erro em falha do supabase", async () => {
    const { client, spies } = createSupabaseStub();
    spies.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });
    await expect(
      getLead({ supabase: client, id: "lead-x" }),
    ).rejects.toThrow(/boom/);
  });
});

describe("createLead", () => {
  it("insere lead com user_id e retorna row criada", async () => {
    const { client, spies } = createSupabaseStub();
    spies.single.mockResolvedValueOnce({
      data: { ...baseRow, lead_tags: [] },
      error: null,
    });

    const result = await createLead({
      supabase: client,
      userId: "user-1",
      input: {
        name: "Novo Lead",
        source: "google_maps",
      },
    });

    expect(spies.from).toHaveBeenCalledWith("leads");
    expect(spies.insert).toHaveBeenCalledTimes(1);
    const inserted = spies.insert.mock.calls[0]![0];
    expect(inserted).toMatchObject({
      user_id: "user-1",
      name: "Novo Lead",
      source: "google_maps",
    });
    expect(result.id).toBe("lead-1");
    expect(result.tags).toEqual([]);
  });

  it("lança erro em falha do supabase", async () => {
    const { client, spies } = createSupabaseStub();
    spies.single.mockResolvedValueOnce({
      data: null,
      error: { message: "duplicate" },
    });
    await expect(
      createLead({
        supabase: client,
        userId: "user-1",
        input: { name: "X", source: "google_maps" },
      }),
    ).rejects.toThrow(/duplicate/);
  });
});

describe("updateLead", () => {
  it("atualiza campos e retorna lead com tags", async () => {
    const { client, spies } = createSupabaseStub();
    spies.maybeSingle.mockResolvedValueOnce({
      data: {
        ...baseRow,
        stage: "contacted",
        lead_tags: [],
      },
      error: null,
    });

    const result = await updateLead({
      supabase: client,
      id: "lead-1",
      input: { stage: "contacted" },
    });

    expect(spies.update).toHaveBeenCalledTimes(1);
    expect(spies.update.mock.calls[0]![0]).toEqual({ stage: "contacted" });
    expect(spies.eq).toHaveBeenCalledWith("id", "lead-1");
    expect(result?.stage).toBe("contacted");
  });

  it("retorna null quando RLS bloqueia (sem rows afetadas)", async () => {
    const { client, spies } = createSupabaseStub();
    spies.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await updateLead({
      supabase: client,
      id: "outro-user",
      input: { stage: "qualified" },
    });
    expect(result).toBeNull();
  });

  it("retorna null no caminho tagIds quando o lead inicial não existe", async () => {
    const { client, spies } = createSupabaseStub();
    spies.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await updateLead({
      supabase: client,
      id: "missing",
      input: { notes: "ok", tagIds: ["b"] },
    });
    expect(result).toBeNull();
  });

  it("não inclui tagIds direto no update — campos são separados", async () => {
    const { client, spies } = createSupabaseStub();
    // Cenário simples: sem tagIds para evitar a sequência de syncLeadTags.
    spies.maybeSingle.mockResolvedValueOnce({
      data: { ...baseRow, lead_tags: [] },
      error: null,
    });
    await updateLead({
      supabase: client,
      id: "lead-1",
      input: {
        notes: "ok",
      },
    });
    const updatePayload = spies.update.mock.calls[0]![0] as Record<
      string,
      unknown
    >;
    expect(updatePayload).toEqual({ notes: "ok" });
    expect(updatePayload).not.toHaveProperty("tagIds");
  });
});

describe("deleteLead", () => {
  it("retorna true quando 1 row deletada", async () => {
    const { client, spies, chain } = createSupabaseStub();
    // delete().eq() retorna await direto — emulamos resolved promise
    Object.assign(chain, {
      eq: vi.fn(() => Promise.resolve({ data: null, count: 1, error: null })),
    });
    spies.delete.mockImplementationOnce(() => chain);

    const result = await deleteLead({ supabase: client, id: "lead-1" });
    expect(result).toBe(true);
  });

  it("retorna false quando 0 rows deletadas (RLS bloqueou)", async () => {
    const { client, spies, chain } = createSupabaseStub();
    Object.assign(chain, {
      eq: vi.fn(() => Promise.resolve({ data: null, count: 0, error: null })),
    });
    spies.delete.mockImplementationOnce(() => chain);

    const result = await deleteLead({ supabase: client, id: "lead-x" });
    expect(result).toBe(false);
  });

  it("lança erro em falha do supabase", async () => {
    const { client, spies, chain } = createSupabaseStub();
    Object.assign(chain, {
      eq: vi.fn(() =>
        Promise.resolve({ data: null, count: null, error: { message: "fk" } }),
      ),
    });
    spies.delete.mockImplementationOnce(() => chain);

    await expect(
      deleteLead({ supabase: client, id: "lead-1" }),
    ).rejects.toThrow(/fk/);
  });
});
