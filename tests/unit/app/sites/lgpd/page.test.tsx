/**
 * Testes da rota `/sites/[slug]/lgpd` (issue #234).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

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
  usePathname: () => `/sites/${SLUG}/lgpd`,
}));

const SITE_ID = "44444444-4444-4444-8444-444444444444";
const SLUG = "j7k2p9-touring-cars";

function makeRow(
  status: "draft" | "published" | "sent" | "archived",
  variables: SiteVariablesV2 = SITE_FIXTURE,
) {
  return {
    id: SITE_ID,
    slug: SLUG,
    status,
    variables,
    signed_at: null,
    visual_identity: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/sites/[slug]/lgpd", () => {
  it("status='published' renderiza política PT-BR com dados do negócio", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { default: Page } = await import("@/app/sites/[slug]/lgpd/page");

    const tree = await Page({ params: Promise.resolve({ slug: SLUG }) });
    const html = renderToStaticMarkup(tree);

    expect(html).toContain("Política de Privacidade");
    expect(html).toContain(SITE_FIXTURE.business_name);
    expect(html).toContain(SITE_FIXTURE.email!);
    expect(html).toContain("Direitos do titular");
    expect(html).toContain("acesso");
    expect(html).toContain("retificação");
    expect(html).toContain("exclusão");
    expect(html).toContain("portabilidade");
  });

  it("draft → notFound", async () => {
    getSiteMock.mockResolvedValue(makeRow("draft"));
    const { default: Page } = await import("@/app/sites/[slug]/lgpd/page");

    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("generateMetadata preserva noindex e usa título da política", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { generateMetadata } = await import("@/app/sites/[slug]/lgpd/page");

    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG }),
    });

    expect(meta.title).toBe(`Política de Privacidade — ${SITE_FIXTURE.business_name}`);
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
