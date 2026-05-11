/**
 * Testes do `app/sitemap.ts` — issue #212 / Sprint 1 / #S2.
 *
 * Cobertura:
 *   - 0 sites → `[]`.
 *   - N sites com variables válidos → 5 + cars × N URLs.
 *   - 1 site com variables inválido (safeParse falha) → 5 URLs base.
 *   - DB error → `[]` (graceful).
 *
 * Mocka `lib/sites/list-indexable-sites` direto (não Supabase) — o helper
 * já tem cobertura própria em `list-indexable-sites.test.ts`.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

import { validSiteVariablesFixture } from "@/tests/fixtures/site-variables";

const listMocks = vi.hoisted(() => ({
  listIndexableSites: vi.fn(),
}));

vi.mock("@/lib/sites/list-indexable-sites", () => ({
  listIndexableSites: listMocks.listIndexableSites,
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
});

describe("sitemap.ts (#212)", () => {
  it("retorna [] quando não há sites indexáveis", async () => {
    listMocks.listIndexableSites.mockResolvedValue([]);
    const mod = await import("@/app/sitemap");
    const result = await mod.default();
    expect(result).toEqual([]);
  });

  it("retorna [] quando helper lança (graceful degradation)", async () => {
    listMocks.listIndexableSites.mockRejectedValue(new Error("DB down"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mod = await import("@/app/sitemap");
    const result = await mod.default();
    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });

  it("emite 5 URLs estáticas por site (Home/estoque/sobre/contato/anunciar)", async () => {
    listMocks.listIndexableSites.mockResolvedValue([
      {
        slug: "abc-loja",
        // Variables inválido — usa estruturalmente safeParse fallback
        variables: { not_valid: true },
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: "2026-05-09T10:00:00Z",
        status: "published",
      },
    ]);
    const mod = await import("@/app/sitemap");
    const result = await mod.default();
    expect(result).toHaveLength(5);
    const urls = result.map((entry) => entry.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "http://localhost:3000/sites/abc-loja",
        "http://localhost:3000/sites/abc-loja/estoque",
        "http://localhost:3000/sites/abc-loja/sobre",
        "http://localhost:3000/sites/abc-loja/contato",
        "http://localhost:3000/sites/abc-loja/anunciar",
      ]),
    );
  });

  it("inclui priority Home > Estoque > Sobre/Contato > Anunciar", async () => {
    listMocks.listIndexableSites.mockResolvedValue([
      {
        slug: "abc",
        variables: { not_valid: true },
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: "2026-05-09T10:00:00Z",
        status: "published",
      },
    ]);
    const mod = await import("@/app/sitemap");
    const result = await mod.default();
    const home = result.find((e) => e.url.endsWith("/sites/abc"));
    const estoque = result.find((e) => e.url.endsWith("/estoque"));
    const anunciar = result.find((e) => e.url.endsWith("/anunciar"));
    expect(home?.priority).toBe(1.0);
    expect(estoque?.priority).toBe(0.9);
    expect(anunciar?.priority).toBe(0.6);
  });

  it("inclui lastModified parseado de updated_at", async () => {
    listMocks.listIndexableSites.mockResolvedValue([
      {
        slug: "abc",
        variables: { not_valid: true },
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: "2026-05-09T10:00:00Z",
        status: "published",
      },
    ]);
    const mod = await import("@/app/sitemap");
    const result = await mod.default();
    for (const entry of result) {
      expect(entry.lastModified).toBeInstanceOf(Date);
      expect((entry.lastModified as Date).toISOString()).toBe(
        "2026-05-10T10:00:00.000Z",
      );
    }
  });

  it("emite URLs no formato absoluto (NEXT_PUBLIC_APP_URL)", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://gasplab.com";
    vi.resetModules();
    listMocks.listIndexableSites.mockResolvedValue([
      {
        slug: "minha-loja",
        variables: { not_valid: true },
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: "2026-05-09T10:00:00Z",
        status: "published",
      },
    ]);
    const mod = await import("@/app/sitemap");
    const result = await mod.default();
    for (const entry of result) {
      expect(entry.url.startsWith("https://gasplab.com/sites/minha-loja")).toBe(
        true,
      );
    }
    // Reset for other tests
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    vi.resetModules();
  });

  it("trim trailing slash de NEXT_PUBLIC_APP_URL", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://gasplab.com/";
    vi.resetModules();
    listMocks.listIndexableSites.mockResolvedValue([
      {
        slug: "x",
        variables: { not_valid: true },
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: "2026-05-09T10:00:00Z",
        status: "published",
      },
    ]);
    const mod = await import("@/app/sitemap");
    const result = await mod.default();
    const home = result.find((e) => e.url.endsWith("/sites/x"));
    expect(home?.url).toBe("https://gasplab.com/sites/x");
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    vi.resetModules();
  });

  it("aceita múltiplos sites — emite 5 URLs por site", async () => {
    listMocks.listIndexableSites.mockResolvedValue([
      {
        slug: "loja-a",
        variables: { invalid: true },
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: "2026-05-09T10:00:00Z",
        status: "published",
      },
      {
        slug: "loja-b",
        variables: { invalid: true },
        updated_at: "2026-05-10T11:00:00Z",
        signed_at: "2026-05-09T11:00:00Z",
        status: "sent",
      },
    ]);
    const mod = await import("@/app/sitemap");
    const result = await mod.default();
    expect(result).toHaveLength(10);
    const slugA = result.filter((e) => e.url.includes("/sites/loja-a"));
    const slugB = result.filter((e) => e.url.includes("/sites/loja-b"));
    expect(slugA).toHaveLength(5);
    expect(slugB).toHaveLength(5);
  });

  it("changeFrequency: home/estoque = 'daily', sobre/contato/anunciar = 'monthly'", async () => {
    listMocks.listIndexableSites.mockResolvedValue([
      {
        slug: "abc",
        variables: { invalid: true },
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: "2026-05-09T10:00:00Z",
        status: "published",
      },
    ]);
    const mod = await import("@/app/sitemap");
    const result = await mod.default();
    expect(
      result.find((e) => e.url.endsWith("/sites/abc"))?.changeFrequency,
    ).toBe("daily");
    expect(
      result.find((e) => e.url.endsWith("/estoque"))?.changeFrequency,
    ).toBe("daily");
    expect(result.find((e) => e.url.endsWith("/sobre"))?.changeFrequency).toBe(
      "monthly",
    );
    expect(
      result.find((e) => e.url.endsWith("/anunciar"))?.changeFrequency,
    ).toBe("monthly");
  });

  it("expone `revalidate = 3600` (ISR 1h)", async () => {
    const mod = await import("@/app/sitemap");
    expect(mod.revalidate).toBe(3600);
  });

  // Smoke: variables válido + cars não explodem (V1: car detail OUT OF SCOPE).
  // Quando V2 incluir car detail, mudar este teste pra esperar 5 + cars.
  it("não inclui /estoque/[carSlug] em V1 (5 URLs mesmo com cars válidos)", async () => {
    listMocks.listIndexableSites.mockResolvedValue([
      {
        slug: "abc",
        variables: validSiteVariablesFixture,
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: "2026-05-09T10:00:00Z",
        status: "published",
      },
    ]);
    const mod = await import("@/app/sitemap");
    const result = await mod.default();
    expect(result).toHaveLength(5);
    expect(result.every((e) => !e.url.includes("/estoque/"))).toBe(true);
  });
});
