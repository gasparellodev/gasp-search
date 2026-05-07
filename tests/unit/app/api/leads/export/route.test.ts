import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabase: vi.fn(),
}));

const listLeadsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

vi.mock("@/lib/leads/list-leads", () => ({
  listLeads: listLeadsMock,
}));

function makeGetRequest(url: string) {
  return new Request(url, { method: "GET" });
}

async function importRoute() {
  return import("@/app/api/leads/export/route");
}

beforeEach(() => {
  vi.resetModules();
  listLeadsMock.mockReset();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.createServerSupabase.mockReset();
  supabaseMocks.createServerSupabase.mockResolvedValue({
    auth: { getUser: supabaseMocks.getUser },
  });
});

describe("GET /api/leads/export", () => {
  it("retorna 401 quando não há usuário autenticado", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { GET } = await importRoute();
    const response = await GET(
      makeGetRequest("http://localhost/api/leads/export"),
    );

    expect(response.status).toBe(401);
    expect(listLeadsMock).not.toHaveBeenCalled();
  });

  it("exporta CSV com BOM UTF-8, headers humanos e filtros aplicados", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    listLeadsMock
      .mockResolvedValueOnce({
        leads: [
          {
            name: 'Café "São, Bento"',
            category: "Cafeteria",
            city: "São Paulo",
            state: "SP",
            phone: "+55 11 99999-0000",
            email: "contato@cafe.com.br",
            website: "cafe.com.br",
            instagram_handle: "cafesaobento",
            whatsapp: null,
            has_website: true,
            rating: 4.8,
            reviews_count: 231,
            followers_count: null,
            stage: "new",
            score: 82,
            source: "google_maps",
            notes: "Linha 1\nLinha 2",
            created_at: "2026-05-07T12:00:00Z",
            tags: [{ id: "tag-1", name: "Prioritário", color: "#16a34a" }],
          },
        ],
        totalCount: 101,
        page: 1,
        pageSize: 100,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        leads: [
          {
            name: "Barbearia Bigode",
            category: null,
            city: "Curitiba",
            state: "PR",
            phone: null,
            email: null,
            website: null,
            instagram_handle: null,
            whatsapp: "+55 41 98888-0000",
            has_website: false,
            rating: null,
            reviews_count: null,
            followers_count: null,
            stage: "contacted",
            score: 35,
            source: "google_maps",
            notes: null,
            created_at: "2026-05-06T09:00:00Z",
            tags: [],
          },
        ],
        totalCount: 101,
        page: 2,
        pageSize: 100,
        totalPages: 2,
      });

    const { GET } = await importRoute();
    const response = await GET(
      makeGetRequest(
        "http://localhost/api/leads/export?stage=new&q=caf%C3%A9&hasWebsite=true&tagId=tag-1",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "text/csv; charset=utf-8",
    );
    expect(response.headers.get("content-disposition")).toContain(
      'filename="leads-export.csv"',
    );

    const bytes = new Uint8Array(await response.clone().arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const csv = await response.text();
    expect(csv).toContain(
      "Nome,Categoria,Cidade,Estado,Telefone,E-mail,Website,Instagram,WhatsApp,Tem site,Avaliação,Reviews,Seguidores,Estágio,Score,Fonte,Tags,Notas,Criado em",
    );
    expect(csv).toContain('"Café ""São, Bento"""');
    expect(csv).toContain('"Linha 1\nLinha 2"');
    expect(csv).toContain("Prioritário");
    expect(csv).toContain("Barbearia Bigode");

    expect(listLeadsMock).toHaveBeenCalledTimes(2);
    expect(listLeadsMock.mock.calls[0]![0]).toMatchObject({
      params: { page: 1, pageSize: 100 },
      filters: {
        q: "café",
        stage: "new",
        hasWebsite: true,
        tagIds: ["tag-1"],
      },
    });
    expect(listLeadsMock.mock.calls[1]![0].params.page).toBe(2);
  });

  it("retorna 502 quando a listagem falha", async () => {
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    listLeadsMock.mockRejectedValue(new Error("PGRST"));

    const { GET } = await importRoute();
    const response = await GET(
      makeGetRequest("http://localhost/api/leads/export"),
    );

    expect(response.status).toBe(502);
  });
});
