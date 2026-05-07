import { describe, expect, it, vi } from "vitest";
import { listLeads } from "@/lib/leads/list-leads";

type ChainResult = {
  data: unknown;
  count: number | null;
  error: { message: string } | null;
};

function createSupabaseMock(result: ChainResult) {
  const range = vi.fn<(from: number, to: number) => Promise<ChainResult>>(
    async () => result,
  );
  const order = vi.fn<(column: string, opts: { ascending: boolean }) => {
    range: typeof range;
  }>(() => ({ range }));
  const select = vi.fn<(query: string, opts?: { count: "exact" }) => {
    order: typeof order;
  }>(() => ({ order }));
  const from = vi.fn<(table: string) => { select: typeof select }>(() => ({
    select,
  }));
  return {
    client: { from } as unknown as Parameters<typeof listLeads>[0]["supabase"],
    spies: { from, select, order, range },
  };
}

describe("listLeads", () => {
  it("consulta leads com paginação, ordenação e total via count exact", async () => {
    const rows = [
      {
        id: "lead-1",
        user_id: "user-1",
        source: "google_maps",
        source_search_job_id: null,
        name: "Barbearia X",
        category: "Barbearia",
        city: "Curitiba",
        state: "PR",
        country: "BR",
        phone: "+5541999999999",
        email: null,
        website: null,
        instagram_handle: null,
        whatsapp: null,
        has_website: false,
        rating: null,
        reviews_count: null,
        followers_count: null,
        stage: "new",
        score: 10,
        notes: null,
        raw: null,
        enriched_at: null,
        created_at: "2026-05-07T00:00:00Z",
        updated_at: "2026-05-07T00:00:00Z",
        lead_tags: [
          { tag: { id: "tag-1", name: "Frio", color: "#0ea5e9" } },
        ],
      },
    ];

    const { client, spies } = createSupabaseMock({
      data: rows,
      count: 137,
      error: null,
    });

    const result = await listLeads({
      supabase: client,
      params: {
        page: 2,
        pageSize: 50,
        sortBy: "name",
        sortDir: "asc",
      },
    });

    expect(spies.from).toHaveBeenCalledWith("leads");
    expect(spies.select).toHaveBeenCalledTimes(1);
    const [, options] = spies.select.mock.calls[0]!;
    expect(options).toEqual({ count: "exact" });
    expect(spies.order).toHaveBeenCalledWith("name", { ascending: true });
    // page 2 com pageSize 50 → range(50, 99)
    expect(spies.range).toHaveBeenCalledWith(50, 99);

    expect(result.totalCount).toBe(137);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(50);
    expect(result.totalPages).toBe(3); // ceil(137/50)
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0]).toMatchObject({
      id: "lead-1",
      name: "Barbearia X",
      tags: [{ id: "tag-1", name: "Frio", color: "#0ea5e9" }],
    });
  });

  it("calcula range para page 1 e ordena desc por padrão", async () => {
    const { client, spies } = createSupabaseMock({
      data: [],
      count: 0,
      error: null,
    });

    const result = await listLeads({
      supabase: client,
      params: {
        page: 1,
        pageSize: 25,
        sortBy: "created_at",
        sortDir: "desc",
      },
    });

    expect(spies.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(spies.range).toHaveBeenCalledWith(0, 24);
    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.leads).toEqual([]);
  });

  it("lança erro quando supabase retorna error", async () => {
    const { client } = createSupabaseMock({
      data: null,
      count: null,
      error: { message: "PGRST116" },
    });

    await expect(
      listLeads({
        supabase: client,
        params: {
          page: 1,
          pageSize: 25,
          sortBy: "created_at",
          sortDir: "desc",
        },
      }),
    ).rejects.toThrow(/Falha ao listar leads/);
  });

  it("retorna lista vazia de tags quando lead_tags vier vazio ou null", async () => {
    const { client } = createSupabaseMock({
      data: [
        {
          id: "lead-2",
          user_id: "user-1",
          source: "google_maps",
          source_search_job_id: null,
          name: "Sem tags",
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
          lead_tags: null,
        },
      ],
      count: 1,
      error: null,
    });

    const result = await listLeads({
      supabase: client,
      params: {
        page: 1,
        pageSize: 25,
        sortBy: "created_at",
        sortDir: "desc",
      },
    });

    expect(result.leads[0]?.tags).toEqual([]);
  });
});
