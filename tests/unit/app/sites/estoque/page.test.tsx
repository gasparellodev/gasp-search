/**
 * Testes da rota `/sites/[slug]/estoque` (issue #164).
 *
 * Cobertura per AC1 + AC2:
 *   - Status routing idêntico ao raiz (`null`/`draft`/`archived` → 404).
 *   - `published` / `sent` → renderiza (sem 404).
 *   - `metadata.robots = { index: false, follow: false }`.
 *   - Defesa em profundidade: variables inválido → 404.
 *   - `searchParams.categoria` desce pra `<StockSection>`.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { SiteVariablesV2 } from "@/types/lead-site";

import { SITE_FIXTURE } from "../../../components/sites/site-fixtures";

const getSiteMock = vi.hoisted(() => vi.fn());
const navigationMocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/sites/get-site", () => ({
  getSite: getSiteMock,
}));

vi.mock("next/navigation", () => ({
  notFound: navigationMocks.notFound,
  useRouter: () => ({ push: vi.fn() }),
}));

const SITE_ID = "44444444-4444-4444-8444-444444444444";
const SLUG = "j7k2p9-touring-cars";

function makeRow(
  status: "draft" | "published" | "sent" | "archived",
  variables: SiteVariablesV2 = SITE_FIXTURE,
  signed_at: string | null = null,
) {
  return {
    id: SITE_ID,
    slug: SLUG,
    status,
    variables,
    signed_at,
    visual_identity: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/sites/[slug]/estoque — routing", () => {
  it("getSite null → notFound", async () => {
    getSiteMock.mockResolvedValue(null);
    const { default: Page } = await import(
      "@/app/sites/[slug]/estoque/page"
    );

    await expect(
      Page({
        params: Promise.resolve({ slug: "x" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("status='draft' → notFound", async () => {
    getSiteMock.mockResolvedValue(makeRow("draft"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/estoque/page"
    );
    await expect(
      Page({
        params: Promise.resolve({ slug: SLUG }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("status='archived' → notFound", async () => {
    getSiteMock.mockResolvedValue(makeRow("archived"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/estoque/page"
    );
    await expect(
      Page({
        params: Promise.resolve({ slug: SLUG }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("status='published' → renderiza", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/estoque/page"
    );
    const result = await Page({
      params: Promise.resolve({ slug: SLUG }),
      searchParams: Promise.resolve({}),
    });
    expect(navigationMocks.notFound).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("status='sent' → renderiza", async () => {
    getSiteMock.mockResolvedValue(makeRow("sent"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/estoque/page"
    );
    const result = await Page({
      params: Promise.resolve({ slug: SLUG }),
      searchParams: Promise.resolve({}),
    });
    expect(navigationMocks.notFound).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("variables inválido → notFound (defesa em profundidade)", async () => {
    const broken = {
      ...SITE_FIXTURE,
      brand_assets: { ...SITE_FIXTURE.brand_assets, primary_color: "red" as `#${string}` },
    } as unknown as SiteVariablesV2;
    getSiteMock.mockResolvedValue(makeRow("published", broken));
    const { default: Page } = await import(
      "@/app/sites/[slug]/estoque/page"
    );
    await expect(
      Page({
        params: Promise.resolve({ slug: SLUG }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("/sites/[slug]/estoque — searchParams", () => {
  it("categoria string desce pra StockSection", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/estoque/page"
    );
    const result = await Page({
      params: Promise.resolve({ slug: SLUG }),
      searchParams: Promise.resolve({ categoria: "sedan" }),
    });
    expect(result).toBeDefined();
    expect(navigationMocks.notFound).not.toHaveBeenCalled();
  });

  it("categoria array (Next 16 edge) usa o primeiro valor", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/estoque/page"
    );
    const result = await Page({
      params: Promise.resolve({ slug: SLUG }),
      searchParams: Promise.resolve({ categoria: ["sedan", "suv"] }),
    });
    expect(result).toBeDefined();
    expect(navigationMocks.notFound).not.toHaveBeenCalled();
  });

  it("categoria undefined renderiza sem erro", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/estoque/page"
    );
    const result = await Page({
      params: Promise.resolve({ slug: SLUG }),
      searchParams: Promise.resolve({}),
    });
    expect(result).toBeDefined();
    expect(navigationMocks.notFound).not.toHaveBeenCalled();
  });
});

describe("/sites/[slug]/estoque — generateMetadata (#165)", () => {
  it("happy path: published → city-aware title + noindex preservado (signed_at null)", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/estoque/page"
    );

    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG }),
    });

    // #199 city-aware: "Estoque de Seminovos em <city> — <name>"
    expect(meta.title).toBe(
      `Estoque de Seminovos em ${SITE_FIXTURE.address!.city} — ${SITE_FIXTURE.business_name}`,
    );
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.openGraph?.images).toEqual([{ url: SITE_FIXTURE.brand_assets.logo_url }]);
    expect((meta.twitter as { card: string }).card).toBe("summary_large_image");
    expect(meta.alternates?.canonical).toBe(
      `http://localhost:3000/sites/${SITE_FIXTURE.business_slug}/estoque`,
    );
  });

  it("fallback path: getSite null → APENAS noindex", async () => {
    getSiteMock.mockResolvedValue(null);
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/estoque/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "x" }),
    });
    expect(meta).toEqual({ robots: { index: false, follow: false } });
    expect(meta.title).toBeUndefined();
  });

  it("fallback path: draft → APENAS noindex", async () => {
    getSiteMock.mockResolvedValue(makeRow("draft"));
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/estoque/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG }),
    });
    expect(meta).toEqual({ robots: { index: false, follow: false } });
  });

  it("fallback path: archived → APENAS noindex", async () => {
    getSiteMock.mockResolvedValue(makeRow("archived"));
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/estoque/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG }),
    });
    expect(meta).toEqual({ robots: { index: false, follow: false } });
  });

  it("fallback path: variables inválido → APENAS noindex", async () => {
    const broken = {
      ...SITE_FIXTURE,
      brand_assets: { ...SITE_FIXTURE.brand_assets, primary_color: "red" as `#${string}` },
    } as unknown as SiteVariablesV2;
    getSiteMock.mockResolvedValue(makeRow("published", broken));
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/estoque/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG }),
    });
    expect(meta).toEqual({ robots: { index: false, follow: false } });
  });
});
