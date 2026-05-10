/**
 * Testes da rota `/sites/[slug]/anunciar` (issue #163).
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
}));

const SITE_ID = "44444444-4444-4444-8444-444444444444";
const SLUG = "j7k2p9-touring-cars";

function makeRow(
  status: "draft" | "published" | "sent" | "archived",
  variables: SiteVariablesV2 = SITE_FIXTURE,
) {
  return { id: SITE_ID, slug: SLUG, status, variables };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/sites/[slug]/anunciar — routing", () => {
  it("getSite null → notFound", async () => {
    getSiteMock.mockResolvedValue(null);
    const { default: Page } = await import(
      "@/app/sites/[slug]/anunciar/page"
    );
    await expect(
      Page({ params: Promise.resolve({ slug: "x" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("status='draft' → notFound", async () => {
    getSiteMock.mockResolvedValue(makeRow("draft"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/anunciar/page"
    );
    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("status='archived' → notFound", async () => {
    getSiteMock.mockResolvedValue(makeRow("archived"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/anunciar/page"
    );
    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("status='published' → renderiza", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/anunciar/page"
    );
    const result = await Page({
      params: Promise.resolve({ slug: SLUG }),
    });
    expect(navigationMocks.notFound).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("status='sent' → renderiza", async () => {
    getSiteMock.mockResolvedValue(makeRow("sent"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/anunciar/page"
    );
    const result = await Page({
      params: Promise.resolve({ slug: SLUG }),
    });
    expect(result).toBeDefined();
  });

  it("variables inválido → notFound", async () => {
    const broken = {
      ...SITE_FIXTURE,
      brand_assets: { ...SITE_FIXTURE.brand_assets, primary_color: "red" as `#${string}` },
    } as unknown as SiteVariablesV2;
    getSiteMock.mockResolvedValue(makeRow("published", broken));
    const { default: Page } = await import(
      "@/app/sites/[slug]/anunciar/page"
    );
    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("/sites/[slug]/anunciar — generateMetadata (#165)", () => {
  it("happy path: published → title `${business_name} — Anunciar` + noindex preservado", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/anunciar/page"
    );

    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG }),
    });

    expect(meta.title).toBe(`${SITE_FIXTURE.business_name} — Anunciar`);
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.openGraph?.images).toEqual([{ url: SITE_FIXTURE.brand_assets.logo_url }]);
    expect((meta.twitter as { card: string }).card).toBe("summary_large_image");
  });

  it("fallback path: getSite null → APENAS noindex", async () => {
    getSiteMock.mockResolvedValue(null);
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/anunciar/page"
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
      "@/app/sites/[slug]/anunciar/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG }),
    });
    expect(meta).toEqual({ robots: { index: false, follow: false } });
  });

  it("fallback path: archived → APENAS noindex", async () => {
    getSiteMock.mockResolvedValue(makeRow("archived"));
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/anunciar/page"
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
      "@/app/sites/[slug]/anunciar/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG }),
    });
    expect(meta).toEqual({ robots: { index: false, follow: false } });
  });
});
