/**
 * Testes do helper `listIndexableSites` (`lib/sites/list-indexable-sites.ts`)
 * — issue #212 / Sprint 1 / #S2.
 *
 * Cobertura: query Supabase service-role correta, defense-in-depth filter
 * via `isIndexable`, graceful empty/error handling.
 *
 * **Sem `'use cache'` directive aqui:** este helper é chamado pelo
 * `app/sitemap.ts` que controla cache via `export const revalidate = 3600`.
 * Misturar `'use cache'` com `revalidate` causa caching dual confuso.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  createMockSupabaseClient,
  type TableOverride,
} from "@/tests/__mocks__/supabase";

const supabaseMocks = vi.hoisted(() => ({
  serviceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabase: supabaseMocks.serviceClient,
}));

function setSupabaseListResponse(
  data: unknown[] | null,
  error: unknown = null,
) {
  const override: TableOverride = { selectList: { data, error } };
  const client = createMockSupabaseClient({
    tables: { lead_sites: override },
  });
  supabaseMocks.serviceClient.mockReturnValue(client);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listIndexableSites (lib/sites/list-indexable-sites.ts)", () => {
  it("retorna `[]` quando Supabase retorna lista vazia", async () => {
    setSupabaseListResponse([]);
    const { listIndexableSites } = await import(
      "@/lib/sites/list-indexable-sites"
    );

    const result = await listIndexableSites();
    expect(result).toEqual([]);
  });

  it("retorna `[]` quando Supabase retorna error (graceful — não lança)", async () => {
    setSupabaseListResponse(null, new Error("connection refused"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { listIndexableSites } = await import(
      "@/lib/sites/list-indexable-sites"
    );

    const result = await listIndexableSites();
    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("listIndexableSites"),
      expect.anything(),
    );
    consoleSpy.mockRestore();
  });

  it("retorna `[]` quando Supabase retorna data === null", async () => {
    setSupabaseListResponse(null);
    const { listIndexableSites } = await import(
      "@/lib/sites/list-indexable-sites"
    );

    const result = await listIndexableSites();
    expect(result).toEqual([]);
  });

  it("retorna sites assinados (status='published' + signed_at !== null)", async () => {
    const sites = [
      {
        slug: "abc-loja-x",
        variables: { business_name: "Loja X" },
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: "2026-05-09T10:00:00Z",
        status: "published",
      },
      {
        slug: "def-loja-y",
        variables: { business_name: "Loja Y" },
        updated_at: "2026-05-10T12:00:00Z",
        signed_at: "2026-05-09T12:00:00Z",
        status: "sent",
      },
    ];
    setSupabaseListResponse(sites);
    const { listIndexableSites } = await import(
      "@/lib/sites/list-indexable-sites"
    );

    const result = await listIndexableSites();
    expect(result).toHaveLength(2);
    expect(result[0]?.slug).toBe("abc-loja-x");
    expect(result[1]?.slug).toBe("def-loja-y");
  });

  it("defense in depth: filtra rows com signed_at null mesmo se SQL falhar", async () => {
    // Simula drift: Supabase retorna um row com signed_at: null
    // (não deveria — `.not('signed_at', 'is', null)` filtraria — mas
    // a redundância garante consistência com `isIndexable`).
    const sites = [
      {
        slug: "valid",
        variables: {},
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: "2026-05-09T10:00:00Z",
        status: "published",
      },
      {
        slug: "drift-no-signed",
        variables: {},
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: null,
        status: "published",
      },
    ];
    setSupabaseListResponse(sites);
    const { listIndexableSites } = await import(
      "@/lib/sites/list-indexable-sites"
    );

    const result = await listIndexableSites();
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("valid");
  });

  it("defense in depth: filtra rows com status='draft' mesmo se SQL falhar", async () => {
    const sites = [
      {
        slug: "valid",
        variables: {},
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: "2026-05-09T10:00:00Z",
        status: "sent",
      },
      {
        slug: "drift-draft",
        variables: {},
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: "2026-05-09T10:00:00Z",
        status: "draft",
      },
      {
        slug: "drift-archived",
        variables: {},
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: "2026-05-09T10:00:00Z",
        status: "archived",
      },
    ];
    setSupabaseListResponse(sites);
    const { listIndexableSites } = await import(
      "@/lib/sites/list-indexable-sites"
    );

    const result = await listIndexableSites();
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("valid");
  });

  it("query toca a tabela lead_sites", async () => {
    const client = setSupabaseListResponse([]);
    const { listIndexableSites } = await import(
      "@/lib/sites/list-indexable-sites"
    );

    await listIndexableSites();
    expect(client.fromCalls).toContain("lead_sites");
  });

  it("retorna [] quando createServiceSupabase lança (catch-all defensivo)", async () => {
    supabaseMocks.serviceClient.mockImplementation(() => {
      throw new Error("env missing");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { listIndexableSites } = await import(
      "@/lib/sites/list-indexable-sites"
    );

    const result = await listIndexableSites();
    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("unexpected error"),
      expect.anything(),
    );
    consoleSpy.mockRestore();
  });
});
