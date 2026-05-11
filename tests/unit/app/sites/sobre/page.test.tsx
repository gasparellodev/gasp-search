/**
 * Testes da rota `/sites/[slug]/sobre` (issue #163).
 *
 * Cobertura mínima per AC2:
 *   - Status routing idêntico ao raiz (`null`/`draft`/`archived` → 404).
 *   - `published` / `sent` → renderiza (sem 404).
 *   - `metadata.robots = { index: false, follow: false }`.
 *   - Defesa em profundidade: variables inválido → 404.
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
  signed_at: string | null = null,
) {
  return { id: SITE_ID, slug: SLUG, status, variables, signed_at };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/sites/[slug]/sobre — routing", () => {
  it("getSite null → notFound", async () => {
    getSiteMock.mockResolvedValue(null);
    const { default: Page } = await import("@/app/sites/[slug]/sobre/page");

    await expect(
      Page({ params: Promise.resolve({ slug: "x" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("status='draft' → notFound", async () => {
    getSiteMock.mockResolvedValue(makeRow("draft"));
    const { default: Page } = await import("@/app/sites/[slug]/sobre/page");
    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("status='archived' → notFound", async () => {
    getSiteMock.mockResolvedValue(makeRow("archived"));
    const { default: Page } = await import("@/app/sites/[slug]/sobre/page");
    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("status='published' → renderiza", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { default: Page } = await import("@/app/sites/[slug]/sobre/page");
    const result = await Page({
      params: Promise.resolve({ slug: SLUG }),
    });
    expect(navigationMocks.notFound).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("status='sent' → renderiza", async () => {
    getSiteMock.mockResolvedValue(makeRow("sent"));
    const { default: Page } = await import("@/app/sites/[slug]/sobre/page");
    const result = await Page({
      params: Promise.resolve({ slug: SLUG }),
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
    const { default: Page } = await import("@/app/sites/[slug]/sobre/page");

    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("/sites/[slug]/sobre — generateMetadata (#165)", () => {
  it("happy path: published → city-aware title + noindex preservado (signed_at null)", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/sobre/page"
    );

    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG }),
    });

    // #199 city-aware: "Sobre <name> — Loja em <city>"
    expect(meta.title).toBe(
      `Sobre ${SITE_FIXTURE.business_name} — Loja em ${SITE_FIXTURE.address!.city}`,
    );
    // signed_at null → noindex preservado.
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.openGraph?.images).toEqual([{ url: SITE_FIXTURE.brand_assets.logo_url }]);
    expect((meta.twitter as { card: string }).card).toBe("summary_large_image");
  });

  it("#199 — published + signed_at set → robots index:true", async () => {
    getSiteMock.mockResolvedValue(makeRow("published", SITE_FIXTURE, "2026-05-10"));
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/sobre/page"
    );

    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG }),
    });

    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.alternates?.canonical).toBe(
      `http://localhost:3000/sites/${SITE_FIXTURE.business_slug}/sobre`,
    );
  });

  it("fallback path: getSite null → APENAS noindex", async () => {
    getSiteMock.mockResolvedValue(null);
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/sobre/page"
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
      "@/app/sites/[slug]/sobre/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG }),
    });
    expect(meta).toEqual({ robots: { index: false, follow: false } });
  });

  it("fallback path: archived → APENAS noindex", async () => {
    getSiteMock.mockResolvedValue(makeRow("archived"));
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/sobre/page"
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
      "@/app/sites/[slug]/sobre/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG }),
    });
    expect(meta).toEqual({ robots: { index: false, follow: false } });
  });
});
