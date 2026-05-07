import { describe, expect, it, vi } from "vitest";
import { listLeads } from "@/lib/leads/list-leads";

type ChainResult = {
  data: unknown;
  count: number | null;
  error: { message: string } | null;
};

function createSupabaseMock(result: ChainResult, leadIdsResult?: ChainResult) {
  const range = vi.fn(async () => result);
  const order = vi.fn(() => ({ range }));

  type Builder = {
    eq: ReturnType<typeof vi.fn>;
    ilike: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: typeof order;
    range: typeof range;
  };

  const eq: ReturnType<typeof vi.fn> = vi.fn();
  const ilike: ReturnType<typeof vi.fn> = vi.fn();
  const inFn: ReturnType<typeof vi.fn> = vi.fn();
  const builderTail: Builder = { eq, ilike, in: inFn, order, range };
  eq.mockReturnValue(builderTail);
  ilike.mockReturnValue(builderTail);
  inFn.mockReturnValue(builderTail);

  // Tag id subquery: supabase.from("lead_tags").select("lead_id").in("tag_id",...)
  const tagInFn = vi.fn(async () => leadIdsResult ?? result);
  const tagSelect = vi.fn(() => ({ in: tagInFn }));

  const select = vi.fn((_query: string, opts?: unknown) => {
    if (opts && typeof opts === "object" && "count" in opts) {
      return builderTail;
    }
    return { in: tagInFn };
  });

  const from = vi.fn((table: string) => {
    if (table === "lead_tags") {
      return { select: tagSelect };
    }
    return { select };
  });

  return {
    client: { from } as unknown as Parameters<typeof listLeads>[0]["supabase"],
    spies: { from, select, eq, ilike, inFn, order, range, tagInFn, tagSelect },
  };
}

describe("listLeads with filters", () => {
  it("aplica filtro stage via .eq", async () => {
    const { client, spies } = createSupabaseMock({
      data: [],
      count: 0,
      error: null,
    });
    await listLeads({
      supabase: client,
      params: { page: 1, pageSize: 25, sortBy: "created_at", sortDir: "desc" },
      filters: {
        q: undefined,
        stage: "new",
        source: undefined,
        hasWebsite: undefined,
        tagIds: undefined,
      },
    });
    expect(spies.eq).toHaveBeenCalledWith("stage", "new");
  });

  it("aplica filtro source via .eq", async () => {
    const { client, spies } = createSupabaseMock({
      data: [],
      count: 0,
      error: null,
    });
    await listLeads({
      supabase: client,
      params: { page: 1, pageSize: 25, sortBy: "created_at", sortDir: "desc" },
      filters: {
        q: undefined,
        stage: undefined,
        source: "google_maps",
        hasWebsite: undefined,
        tagIds: undefined,
      },
    });
    expect(spies.eq).toHaveBeenCalledWith("source", "google_maps");
  });

  it("aplica hasWebsite true e false", async () => {
    const trueMock = createSupabaseMock({ data: [], count: 0, error: null });
    await listLeads({
      supabase: trueMock.client,
      params: { page: 1, pageSize: 25, sortBy: "created_at", sortDir: "desc" },
      filters: {
        q: undefined,
        stage: undefined,
        source: undefined,
        hasWebsite: true,
        tagIds: undefined,
      },
    });
    expect(trueMock.spies.eq).toHaveBeenCalledWith("has_website", true);

    const falseMock = createSupabaseMock({ data: [], count: 0, error: null });
    await listLeads({
      supabase: falseMock.client,
      params: { page: 1, pageSize: 25, sortBy: "created_at", sortDir: "desc" },
      filters: {
        q: undefined,
        stage: undefined,
        source: undefined,
        hasWebsite: false,
        tagIds: undefined,
      },
    });
    expect(falseMock.spies.eq).toHaveBeenCalledWith("has_website", false);
  });

  it("aplica busca q via .ilike no name", async () => {
    const { client, spies } = createSupabaseMock({
      data: [],
      count: 0,
      error: null,
    });
    await listLeads({
      supabase: client,
      params: { page: 1, pageSize: 25, sortBy: "created_at", sortDir: "desc" },
      filters: {
        q: "barbearia",
        stage: undefined,
        source: undefined,
        hasWebsite: undefined,
        tagIds: undefined,
      },
    });
    expect(spies.ilike).toHaveBeenCalledWith("name", "%barbearia%");
  });

  it("filtro tagIds resolve lead_ids via subquery e aplica .in('id')", async () => {
    const { client, spies } = createSupabaseMock(
      { data: [], count: 0, error: null },
      {
        data: [{ lead_id: "lead-1" }, { lead_id: "lead-2" }],
        count: 2,
        error: null,
      },
    );
    await listLeads({
      supabase: client,
      params: { page: 1, pageSize: 25, sortBy: "created_at", sortDir: "desc" },
      filters: {
        q: undefined,
        stage: undefined,
        source: undefined,
        hasWebsite: undefined,
        tagIds: ["tag-1", "tag-2"],
      },
    });
    expect(spies.tagSelect).toHaveBeenCalledWith("lead_id");
    expect(spies.tagInFn).toHaveBeenCalledWith("tag_id", ["tag-1", "tag-2"]);
    expect(spies.inFn).toHaveBeenCalledWith("id", ["lead-1", "lead-2"]);
  });

  it("filtro tagIds que retorna 0 leads short-circuita sem chamar leads", async () => {
    const tagSubMock = createSupabaseMock(
      { data: [], count: 0, error: null },
      { data: [], count: 0, error: null },
    );
    const result = await listLeads({
      supabase: tagSubMock.client,
      params: { page: 1, pageSize: 25, sortBy: "created_at", sortDir: "desc" },
      filters: {
        q: undefined,
        stage: undefined,
        source: undefined,
        hasWebsite: undefined,
        tagIds: ["tag-x"],
      },
    });
    expect(result.totalCount).toBe(0);
    expect(result.leads).toEqual([]);
    // não chamou .in("id", ...) na tabela leads
    expect(tagSubMock.spies.inFn).not.toHaveBeenCalled();
  });
});
