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

import type { SiteVariables } from "@/types/lead-site";

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
  variables: SiteVariables = SITE_FIXTURE,
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
      primary_color: "red",
    } as unknown as SiteVariables;
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

describe("/sites/[slug]/estoque/[carSlug] — metadata", () => {
  it("export `metadata.robots = { index: false, follow: false }`", async () => {
    const mod = await import("@/app/sites/[slug]/estoque/[carSlug]/page");
    expect(mod.metadata?.robots).toEqual({ index: false, follow: false });
  });
});
