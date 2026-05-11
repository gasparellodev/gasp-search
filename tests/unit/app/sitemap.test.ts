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

import { fixtureSiteVariablesV2 } from "@/tests/fixtures/site-variables/site-variables-v2";
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

  // Car detail URLs: extraídas de `variables.cars[]` via `SiteVariablesV2.safeParse`.
  it("inclui /estoque/[carSlug] quando variables é SiteVariablesV2 válido", async () => {
    listMocks.listIndexableSites.mockResolvedValue([
      {
        slug: "auto-fit",
        variables: fixtureSiteVariablesV2,
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: "2026-05-09T10:00:00Z",
        status: "published",
      },
    ]);
    const mod = await import("@/app/sitemap");
    const result = await mod.default();

    // 5 estáticas + 4 cars (v2 fixture tem 4 cars — min do schema).
    expect(result).toHaveLength(9);

    const carUrls = result.filter((e) => /\/estoque\/[a-z0-9-]+$/.test(e.url));
    expect(carUrls).toHaveLength(4);
    // Cada car URL tem priority 0.8 + weekly.
    for (const entry of carUrls) {
      expect(entry.priority).toBe(0.8);
      expect(entry.changeFrequency).toBe("weekly");
      expect(entry.lastModified).toBeInstanceOf(Date);
    }
    // Slugs vêm do fixture (`bmw-m2-2023-001` etc.).
    const urls = carUrls.map((e) => e.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "http://localhost:3000/sites/auto-fit/estoque/bmw-m2-2023-001",
        "http://localhost:3000/sites/auto-fit/estoque/porsche-911-gt3-2024-002",
      ]),
    );
  });

  it("skip car detail URLs + console.warn quando variables falha SiteVariablesV2.safeParse", async () => {
    listMocks.listIndexableSites.mockResolvedValue([
      {
        slug: "abc",
        // v1 shape — falha safeParse de V2 (sem brand_assets/schema_version).
        variables: validSiteVariablesFixture,
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: "2026-05-09T10:00:00Z",
        status: "published",
      },
    ]);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mod = await import("@/app/sitemap");
    const result = await mod.default();

    // Apenas as 5 estáticas — car detail URLs foram puladas, sem crash.
    expect(result).toHaveLength(5);
    expect(result.every((e) => !/\/estoque\/[a-z0-9-]+$/.test(e.url))).toBe(
      true,
    );
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(
      /SiteVariablesV2 parse failed for slug=abc/,
    );

    warnSpy.mockRestore();
  });

  it("variables inválido em UM site não derruba car URLs dos outros sites", async () => {
    listMocks.listIndexableSites.mockResolvedValue([
      {
        slug: "site-bom",
        variables: fixtureSiteVariablesV2,
        updated_at: "2026-05-10T10:00:00Z",
        signed_at: "2026-05-09T10:00:00Z",
        status: "published",
      },
      {
        slug: "site-ruim",
        variables: { not_valid: true },
        updated_at: "2026-05-10T11:00:00Z",
        signed_at: "2026-05-09T11:00:00Z",
        status: "sent",
      },
    ]);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mod = await import("@/app/sitemap");
    const result = await mod.default();

    // site-bom: 5 estáticas + 4 cars = 9. site-ruim: 5 estáticas. Total 14.
    expect(result).toHaveLength(14);

    const bomCars = result.filter(
      (e) => e.url.includes("/sites/site-bom/estoque/") && e.url !== "x",
    );
    const ruimCars = result.filter((e) =>
      /\/sites\/site-ruim\/estoque\/[a-z0-9-]+$/.test(e.url),
    );
    expect(bomCars.length).toBeGreaterThanOrEqual(4);
    expect(ruimCars).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });
});
