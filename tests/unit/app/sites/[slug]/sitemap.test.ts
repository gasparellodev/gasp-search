/**
 * Tests for `app/sites/[slug]/sitemap.ts`
 *
 * Issue #S2 — per-site sitemap with static routes + car detail URLs.
 *
 * **Architecture note:** cars live in `variables.cars[]` (JSONB on
 * `lead_sites`) — there is no separate `cars` DB table. The sitemap
 * reads the site row via `getSite()` and parses `SiteVariablesV2` to
 * extract car slugs.
 *
 * **`isIndexable` gate:** requires status `published`|`sent` AND
 * `signed_at !== null`. All published-site mocks include a non-null
 * `signed_at` to satisfy the gate.
 *
 * `fixtureSiteVariablesV2` has 4 cars:
 *   - "bmw-m2-2023-001"
 *   - "porsche-911-gt3-2024-002"
 *   - "ford-mustang-gt-2022-003"
 *   - "honda-civic-type-r-2021-004"
 * So a published site with this fixture → 6 static + 4 car = 10 entries.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/sites/get-site");
vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://app.test" },
}));

import siteSitemap from "@/app/sites/[slug]/sitemap";
import { getSite } from "@/lib/sites/get-site";
import { fixtureSiteVariablesV2 } from "@/tests/fixtures/site-variables/site-variables-v2";

/** Returns a published+signed site mock with the given variables payload. */
const makePublishedSite = (
  slug: string,
  variables: unknown = fixtureSiteVariablesV2,
) => ({
  id: "site-1",
  slug,
  status: "published" as const,
  signed_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-10T10:00:00Z",
  variables,
});

describe("site sitemap (per slug)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 6 static routes + dynamic car routes for published site", async () => {
    // fixtureSiteVariablesV2 has 4 cars (see fixture header comment)
    vi.mocked(getSite).mockResolvedValue(
      makePublishedSite("poliguara") as never,
    );

    const result = await siteSitemap({
      params: Promise.resolve({ slug: "poliguara" }),
    });

    // 6 static + 4 cars = 10
    expect(result).toHaveLength(10);
    const urls = result.map((r) => r.url);
    // All 6 static routes present
    expect(urls).toContain("https://app.test/sites/poliguara");
    expect(urls).toContain("https://app.test/sites/poliguara/sobre");
    expect(urls).toContain("https://app.test/sites/poliguara/contato");
    expect(urls).toContain("https://app.test/sites/poliguara/anunciar");
    expect(urls).toContain("https://app.test/sites/poliguara/estoque");
    expect(urls).toContain("https://app.test/sites/poliguara/lgpd");
    // First car detail URL present
    expect(urls).toContain(
      `https://app.test/sites/poliguara/estoque/${fixtureSiteVariablesV2.cars[0]!.slug}`,
    );
  });

  it("root entry has priority 1.0 and changeFrequency weekly", async () => {
    vi.mocked(getSite).mockResolvedValue(
      makePublishedSite("poliguara") as never,
    );

    const result = await siteSitemap({
      params: Promise.resolve({ slug: "poliguara" }),
    });

    const root = result.find(
      (r) => r.url === "https://app.test/sites/poliguara",
    );
    expect(root).toBeDefined();
    expect(root!.priority).toBe(1.0);
    expect(root!.changeFrequency).toBe("weekly");
  });

  it("non-root static routes have priority 0.7", async () => {
    vi.mocked(getSite).mockResolvedValue(
      makePublishedSite("poliguara") as never,
    );

    const result = await siteSitemap({
      params: Promise.resolve({ slug: "poliguara" }),
    });

    const nonRootStatic = result.filter(
      (r) =>
        r.url !== "https://app.test/sites/poliguara" &&
        !r.url.includes("/estoque/"),
    );
    expect(nonRootStatic.length).toBeGreaterThan(0);
    for (const entry of nonRootStatic) {
      expect(entry.priority).toBe(0.7);
    }
  });

  it("car detail entries have priority 0.6", async () => {
    vi.mocked(getSite).mockResolvedValue(
      makePublishedSite("poliguara") as never,
    );

    const result = await siteSitemap({
      params: Promise.resolve({ slug: "poliguara" }),
    });

    const carEntries = result.filter((r) => r.url.includes("/estoque/"));
    // fixture has 4 cars; all should have priority 0.6
    expect(carEntries.length).toBe(fixtureSiteVariablesV2.cars.length);
    for (const entry of carEntries) {
      expect(entry.priority).toBe(0.6);
    }
  });

  it("returns empty array for draft site", async () => {
    vi.mocked(getSite).mockResolvedValue({
      slug: "x",
      status: "draft",
      signed_at: null,
    } as never);
    expect(
      await siteSitemap({ params: Promise.resolve({ slug: "x" }) }),
    ).toEqual([]);
  });

  it("returns empty array for archived site", async () => {
    vi.mocked(getSite).mockResolvedValue({
      slug: "x",
      status: "archived",
      signed_at: "2026-05-01T00:00:00Z",
    } as never);
    expect(
      await siteSitemap({ params: Promise.resolve({ slug: "x" }) }),
    ).toEqual([]);
  });

  it("returns empty array for published site without signed_at", async () => {
    vi.mocked(getSite).mockResolvedValue({
      slug: "x",
      status: "published",
      signed_at: null,
    } as never);
    expect(
      await siteSitemap({ params: Promise.resolve({ slug: "x" }) }),
    ).toEqual([]);
  });

  it("returns empty array when site not found", async () => {
    vi.mocked(getSite).mockResolvedValue(null);
    expect(
      await siteSitemap({ params: Promise.resolve({ slug: "missing" }) }),
    ).toEqual([]);
  });

  it("returns only 6 static routes when published with zero cars (empty cars array)", async () => {
    vi.mocked(getSite).mockResolvedValue(
      makePublishedSite("x", {
        ...fixtureSiteVariablesV2,
        cars: [],
      }) as never,
    );

    const result = await siteSitemap({ params: Promise.resolve({ slug: "x" }) });
    // SiteVariablesV2 requires min SITE_STOCK_MIN_CARS (4) cars — zero cars means parse failure → 6 static
    expect(result).toHaveLength(6);
  });

  it("returns only 6 static routes when variables parse fails", async () => {
    vi.mocked(getSite).mockResolvedValue(
      makePublishedSite("broken", { schema_version: 2, not_valid: true }) as never,
    );

    const result = await siteSitemap({
      params: Promise.resolve({ slug: "broken" }),
    });
    // static routes preserved even on parse fail (graceful degradation)
    expect(result).toHaveLength(6);
  });
});
