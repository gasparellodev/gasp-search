/**
 * Testes da rota `/sites/[slug]/estoque/[carSlug]` (issue #164).
 *
 * Cobertura per AC5:
 *   - Status routing idêntico ao raiz (`null`/`draft`/`archived` → 404).
 *   - `cars.find` undefined → 404.
 *   - `published` / `sent` + carSlug válido → renderiza.
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
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/actions/site-form", () => ({
  submitSiteForm: vi.fn(async () => ({ success: true })),
}));

const SITE_ID = "44444444-4444-4444-8444-444444444444";
const SLUG = "j7k2p9-touring-cars";
const VALID_CAR_SLUG = "toyota-corolla-2022";

function makeRow(
  status: "draft" | "published" | "sent" | "archived",
  variables: SiteVariablesV2 = SITE_FIXTURE,
) {
  return { id: SITE_ID, slug: SLUG, status, variables };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/sites/[slug]/estoque/[carSlug] — routing", () => {
  it("getSite null → notFound", async () => {
    getSiteMock.mockResolvedValue(null);
    const { default: Page } = await import(
      "@/app/sites/[slug]/estoque/[carSlug]/page"
    );

    await expect(
      Page({
        params: Promise.resolve({ slug: "x", carSlug: VALID_CAR_SLUG }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("status='draft' → notFound", async () => {
    getSiteMock.mockResolvedValue(makeRow("draft"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/estoque/[carSlug]/page"
    );
    await expect(
      Page({
        params: Promise.resolve({ slug: SLUG, carSlug: VALID_CAR_SLUG }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("status='archived' → notFound", async () => {
    getSiteMock.mockResolvedValue(makeRow("archived"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/estoque/[carSlug]/page"
    );
    await expect(
      Page({
        params: Promise.resolve({ slug: SLUG, carSlug: VALID_CAR_SLUG }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("carSlug não encontrado em cars[] → notFound", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/estoque/[carSlug]/page"
    );
    await expect(
      Page({
        params: Promise.resolve({ slug: SLUG, carSlug: "carro-fantasma" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("status='published' + carSlug válido → renderiza", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/estoque/[carSlug]/page"
    );
    const result = await Page({
      params: Promise.resolve({ slug: SLUG, carSlug: VALID_CAR_SLUG }),
    });
    expect(navigationMocks.notFound).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("status='sent' + carSlug válido → renderiza", async () => {
    getSiteMock.mockResolvedValue(makeRow("sent"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/estoque/[carSlug]/page"
    );
    const result = await Page({
      params: Promise.resolve({ slug: SLUG, carSlug: VALID_CAR_SLUG }),
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
      "@/app/sites/[slug]/estoque/[carSlug]/page"
    );
    await expect(
      Page({
        params: Promise.resolve({ slug: SLUG, carSlug: VALID_CAR_SLUG }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("/sites/[slug]/estoque/[carSlug] — generateMetadata (#165)", () => {
  it("happy path: published + carSlug válido → title `${business_name} — ${brand} ${model} ${year}` + noindex", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/estoque/[carSlug]/page"
    );

    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG, carSlug: VALID_CAR_SLUG }),
    });

    // Fixture: { brand: 'Toyota', model: 'Corolla', year: 2022 }
    expect(meta.title).toBe(
      `${SITE_FIXTURE.business_name} — Toyota Corolla 2022`,
    );
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.openGraph?.images).toEqual([{ url: SITE_FIXTURE.brand_assets.logo_url }]);
    expect((meta.twitter as { card: string }).card).toBe("summary_large_image");
  });

  it("fallback path: getSite null → APENAS noindex", async () => {
    getSiteMock.mockResolvedValue(null);
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/estoque/[carSlug]/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "x", carSlug: VALID_CAR_SLUG }),
    });
    expect(meta).toEqual({ robots: { index: false, follow: false } });
    expect(meta.title).toBeUndefined();
  });

  it("fallback path: draft → APENAS noindex", async () => {
    getSiteMock.mockResolvedValue(makeRow("draft"));
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/estoque/[carSlug]/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG, carSlug: VALID_CAR_SLUG }),
    });
    expect(meta).toEqual({ robots: { index: false, follow: false } });
  });

  it("fallback path: archived → APENAS noindex", async () => {
    getSiteMock.mockResolvedValue(makeRow("archived"));
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/estoque/[carSlug]/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG, carSlug: VALID_CAR_SLUG }),
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
      "@/app/sites/[slug]/estoque/[carSlug]/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG, carSlug: VALID_CAR_SLUG }),
    });
    expect(meta).toEqual({ robots: { index: false, follow: false } });
  });

  it("fallback path: carSlug não encontrado em cars[] → APENAS noindex", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { generateMetadata } = await import(
      "@/app/sites/[slug]/estoque/[carSlug]/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG, carSlug: "carro-fantasma" }),
    });
    expect(meta).toEqual({ robots: { index: false, follow: false } });
    expect(meta.title).toBeUndefined();
  });
});
