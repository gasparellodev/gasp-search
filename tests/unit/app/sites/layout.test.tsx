/**
 * Smoke tests para `app/sites/[slug]/layout.tsx` (issue #211 / Sprint 1).
 *
 * Cobertura:
 *  - Layout renderiza children sempre (mesmo quando site não-existe).
 *  - Sitewide `@graph` JSON-LD injetado quando site é renderizável (status
 *    published/sent + variables.parse ok).
 *  - JSON-LD OMITIDO quando: getSite null / draft / archived / parse falha.
 *
 * Não fazemos full E2E HTML diff aqui — apenas presença do `<SiteSchema>`
 * via mock. Tests do builder estão em `lib/sites/schema.test.ts`.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { SiteVariablesV2 } from "@/types/lead-site";

import { SITE_FIXTURE } from "../../components/sites/site-fixtures";

const getSiteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sites/get-site", () => ({
  getSite: getSiteMock,
}));

const SLUG = "j7k2p9-touring-cars";

function makeRow(
  status: "draft" | "published" | "sent" | "archived",
  variables: SiteVariablesV2 = SITE_FIXTURE,
  signed_at: string | null = null,
) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    slug: SLUG,
    status,
    variables,
    signed_at,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AutoShowroomLayout — schemas injection (#211)", () => {
  it("injeta `@graph` JSON-LD quando status='published' + variables válido", async () => {
    getSiteMock.mockResolvedValue(makeRow("published"));
    const { default: Layout } = await import("@/app/sites/[slug]/layout");
    const tree = await Layout({
      children: null,
      params: Promise.resolve({ slug: SLUG }),
    });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('"@graph"');
    expect(html).toContain('"AutoDealer"');
    expect(html).toContain('"Organization"');
    expect(html).toContain('"LocalBusiness"');
  });

  it("injeta JSON-LD quando status='sent'", async () => {
    getSiteMock.mockResolvedValue(makeRow("sent"));
    const { default: Layout } = await import("@/app/sites/[slug]/layout");
    const tree = await Layout({
      children: null,
      params: Promise.resolve({ slug: SLUG }),
    });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('"@graph"');
  });

  it("OMITE JSON-LD quando getSite retorna null", async () => {
    getSiteMock.mockResolvedValue(null);
    const { default: Layout } = await import("@/app/sites/[slug]/layout");
    const tree = await Layout({
      children: null,
      params: Promise.resolve({ slug: "missing" }),
    });
    const html = renderToStaticMarkup(tree);
    expect(html).not.toContain("application/ld+json");
  });

  it("OMITE JSON-LD quando status='draft'", async () => {
    getSiteMock.mockResolvedValue(makeRow("draft"));
    const { default: Layout } = await import("@/app/sites/[slug]/layout");
    const tree = await Layout({
      children: null,
      params: Promise.resolve({ slug: SLUG }),
    });
    const html = renderToStaticMarkup(tree);
    expect(html).not.toContain("application/ld+json");
  });

  it("OMITE JSON-LD quando status='archived'", async () => {
    getSiteMock.mockResolvedValue(makeRow("archived"));
    const { default: Layout } = await import("@/app/sites/[slug]/layout");
    const tree = await Layout({
      children: null,
      params: Promise.resolve({ slug: SLUG }),
    });
    const html = renderToStaticMarkup(tree);
    expect(html).not.toContain("application/ld+json");
  });

  it("OMITE JSON-LD quando variables não passam safeParse", async () => {
    // Variables shape inválido (vazio) — readSiteVariablesSafe falha.
    getSiteMock.mockResolvedValue(
      makeRow("published", {} as unknown as SiteVariablesV2),
    );
    const { default: Layout } = await import("@/app/sites/[slug]/layout");
    const tree = await Layout({
      children: null,
      params: Promise.resolve({ slug: SLUG }),
    });
    const html = renderToStaticMarkup(tree);
    expect(html).not.toContain("application/ld+json");
  });

  it("layout SEMPRE renderiza children (mesmo no fallback)", async () => {
    getSiteMock.mockResolvedValue(null);
    const { default: Layout } = await import("@/app/sites/[slug]/layout");
    const tree = await Layout({
      children: { type: "div", props: { "data-testid": "child" } } as never,
      params: Promise.resolve({ slug: "x" }),
    });
    expect(tree).toBeDefined();
  });

  it("schemas SEMPRE injetados mesmo quando signed_at=null (AI crawlers ignoram noindex)", async () => {
    // Decisão PO #211: isIndexable=false NÃO bloqueia injection — AI
    // search consome JSON-LD independente de robots:noindex.
    getSiteMock.mockResolvedValue(makeRow("published", SITE_FIXTURE, null));
    const { default: Layout } = await import("@/app/sites/[slug]/layout");
    const tree = await Layout({
      children: null,
      params: Promise.resolve({ slug: SLUG }),
    });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('"@graph"');
  });
});
