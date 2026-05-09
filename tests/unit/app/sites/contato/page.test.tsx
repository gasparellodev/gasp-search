/**
 * Testes da rota `/sites/[slug]/contato` (issue #163).
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
}));

const SITE_ID = "44444444-4444-4444-8444-444444444444";
const SLUG = "j7k2p9-touring-cars";

function makeRow(
  status: "draft" | "published" | "sent" | "archived",
  variables: SiteVariables = SITE_FIXTURE,
) {
  return { id: SITE_ID, slug: SLUG, status, variables };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/sites/[slug]/contato — routing", () => {
  it("getSite null → notFound", async () => {
    getSiteMock.mockResolvedValue(null);
    const { default: Page } = await import(
      "@/app/sites/[slug]/contato/page"
    );
    await expect(
      Page({ params: Promise.resolve({ slug: "x" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("status='draft' → notFound", async () => {
    getSiteMock.mockResolvedValue(makeRow("draft"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/contato/page"
    );
    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("status='archived' → notFound", async () => {
    getSiteMock.mockResolvedValue(makeRow("archived"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/contato/page"
    );
    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("status='published' → renderiza", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { default: Page } = await import(
      "@/app/sites/[slug]/contato/page"
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
      "@/app/sites/[slug]/contato/page"
    );
    const result = await Page({
      params: Promise.resolve({ slug: SLUG }),
    });
    expect(result).toBeDefined();
  });

  it("variables inválido → notFound", async () => {
    const broken = {
      ...SITE_FIXTURE,
      primary_color: "red",
    } as unknown as SiteVariables;
    getSiteMock.mockResolvedValue(makeRow("published", broken));
    const { default: Page } = await import(
      "@/app/sites/[slug]/contato/page"
    );
    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("/sites/[slug]/contato — metadata", () => {
  it("metadata.robots noindex/nofollow", async () => {
    const mod = await import("@/app/sites/[slug]/contato/page");
    expect(mod.metadata?.robots).toEqual({ index: false, follow: false });
  });
});
