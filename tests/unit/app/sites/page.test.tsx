/**
 * Testes da rota pública `/sites/[slug]` (issue #160).
 *
 * Cobertura:
 *   - AC1: Routing por status (5 cenários: missing, draft, archived,
 *     published, sent).
 *   - AC2: Defesa em profundidade — variables inválido → notFound().
 *   - AC4: Cache directive presente (`'use cache'`) + chamadas a
 *     `cacheTag(\`site:\${slug}\`)` e `cacheLife({revalidate:3600,expire:86400})`.
 *     Em vitest+jsdom o `'use cache'` é no-op — testamos a invocação
 *     dos helpers que assinam o contrato (mocks de `next/cache`).
 *   - AC6: `metadata.robots = { index: false, follow: false }`.
 *   - AC7: confinamento de `service_role` (verificado externamente via
 *     grep no PR body — aqui só asseguramos o uso correto do mock).
 *
 * Nota sobre cache (AC4 — refinamento PO):
 * A request memoization do `'use cache'` do Next 16 é runtime-dependent
 * e não funciona em vitest puro. Para AC "1 hit no Supabase em 2
 * chamadas", usamos a fallback documentada no body da issue: assert que
 * `cacheTag` foi chamado com a chave correta (contrato satisfeito; o
 * cache real é exercitado em E2E #166 e prod). O dedup runtime é
 * verificado por inspeção do código + Next runtime (não jsdom).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { Database } from "@/types/database";
import type { SiteVariables } from "@/types/lead-site";

import { SITE_FIXTURE } from "../../components/sites/site-fixtures";

type LeadSiteRow = Pick<
  Database["public"]["Tables"]["lead_sites"]["Row"],
  "id" | "slug" | "status" | "variables"
>;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const supabaseMocks = vi.hoisted(() => ({
  serviceClient: vi.fn(),
  maybeSingle: vi.fn(),
}));

const cacheMocks = vi.hoisted(() => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabase: supabaseMocks.serviceClient,
}));

vi.mock("next/cache", () => ({
  cacheTag: cacheMocks.cacheTag,
  cacheLife: cacheMocks.cacheLife,
  // Re-exports não usados pela page mas evita import error se o mock
  // for hoisted antes do compile.
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: navigationMocks.notFound,
}));

// ---------------------------------------------------------------------------
// Fixtures helpers
// ---------------------------------------------------------------------------

const SITE_ID = "44444444-4444-4444-8444-444444444444";
const SLUG = "j7k2p9-touring-cars";

function makeRow(
  status: LeadSiteRow["status"],
  variables: SiteVariables = SITE_FIXTURE,
): LeadSiteRow {
  return {
    id: SITE_ID,
    slug: SLUG,
    status,
    variables,
  };
}

function setSupabaseResponse(row: LeadSiteRow | null, error: unknown = null) {
  supabaseMocks.maybeSingle.mockResolvedValue({
    data: row,
    error,
  });
  const eq = vi.fn(() => ({ maybeSingle: supabaseMocks.maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  supabaseMocks.serviceClient.mockReturnValue({ from });
  return { from, select, eq };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AC1 — Routing por status
// ---------------------------------------------------------------------------

describe("/sites/[slug] — routing por status (AC1)", () => {
  it("slug inexistente → notFound() → 404", async () => {
    setSupabaseResponse(null);
    const { default: Page } = await import("@/app/sites/[slug]/page");

    await expect(
      Page({ params: Promise.resolve({ slug: "nao-existe" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(navigationMocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("status='draft' → notFound() → 404", async () => {
    setSupabaseResponse(makeRow("draft"));
    const { default: Page } = await import("@/app/sites/[slug]/page");

    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(navigationMocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("status='archived' → notFound() (V1; TODO 410 V2) → 404", async () => {
    setSupabaseResponse(makeRow("archived"));
    const { default: Page } = await import("@/app/sites/[slug]/page");

    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(navigationMocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("status='published' → renderiza <SitePage>", async () => {
    setSupabaseResponse(makeRow("published"));
    const { default: Page } = await import("@/app/sites/[slug]/page");

    const result = await Page({ params: Promise.resolve({ slug: SLUG }) });

    expect(navigationMocks.notFound).not.toHaveBeenCalled();
    // SitePage retorna React element. Assert nominal pelo type.
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  it("status='sent' → renderiza <SitePage>", async () => {
    setSupabaseResponse(makeRow("sent"));
    const { default: Page } = await import("@/app/sites/[slug]/page");

    const result = await Page({ params: Promise.resolve({ slug: SLUG }) });

    expect(navigationMocks.notFound).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("Supabase retorna error → notFound() (não vaza erro pro client)", async () => {
    setSupabaseResponse(null, new Error("connection refused"));
    const { default: Page } = await import("@/app/sites/[slug]/page");

    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// AC2 — Defesa em profundidade: SiteVariables.safeParse
// ---------------------------------------------------------------------------

describe("/sites/[slug] — defesa em profundidade (AC2)", () => {
  it("variables inválido (primary_color='red') → notFound() sem crash", async () => {
    const broken = {
      ...SITE_FIXTURE,
      primary_color: "red",
    } as unknown as SiteVariables;
    setSupabaseResponse(makeRow("published", broken));
    const { default: Page } = await import("@/app/sites/[slug]/page");

    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(navigationMocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("variables = {} (vazio) → notFound()", async () => {
    setSupabaseResponse(
      makeRow("published", {} as unknown as SiteVariables),
    );
    const { default: Page } = await import("@/app/sites/[slug]/page");

    await expect(
      Page({ params: Promise.resolve({ slug: SLUG }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("variables válido (SITE_FIXTURE) → renderiza", async () => {
    setSupabaseResponse(makeRow("published"));
    const { default: Page } = await import("@/app/sites/[slug]/page");

    const result = await Page({ params: Promise.resolve({ slug: SLUG }) });
    expect(result).toBeDefined();
    expect(navigationMocks.notFound).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC4 — Cache directive (cacheTag + cacheLife)
// ---------------------------------------------------------------------------

describe("/sites/[slug] — cache (AC4)", () => {
  it("cacheTag(`site:${slug}`) é chamado com o slug correto", async () => {
    setSupabaseResponse(makeRow("published"));
    const { default: Page } = await import("@/app/sites/[slug]/page");

    await Page({ params: Promise.resolve({ slug: SLUG }) });

    expect(cacheMocks.cacheTag).toHaveBeenCalledWith(`site:${SLUG}`);
  });

  it("cacheLife é chamado com {revalidate: 3600, expire: 86400}", async () => {
    setSupabaseResponse(makeRow("published"));
    const { default: Page } = await import("@/app/sites/[slug]/page");

    await Page({ params: Promise.resolve({ slug: SLUG }) });

    expect(cacheMocks.cacheLife).toHaveBeenCalledWith({
      revalidate: 3600,
      expire: 86400,
    });
  });

  it("supabase é consultado com filtro eq('slug', <slug>)", async () => {
    const handles = setSupabaseResponse(makeRow("published"));
    const { default: Page } = await import("@/app/sites/[slug]/page");

    await Page({ params: Promise.resolve({ slug: SLUG }) });

    expect(handles.from).toHaveBeenCalledWith("lead_sites");
    expect(handles.select).toHaveBeenCalledWith(
      "id, slug, status, variables",
    );
    expect(handles.eq).toHaveBeenCalledWith("slug", SLUG);
  });
});

// ---------------------------------------------------------------------------
// AC6 — generateMetadata dinâmico + noindex em todos os caminhos (#165)
// ---------------------------------------------------------------------------

describe("/sites/[slug] — generateMetadata (AC6 / #165)", () => {
  it("happy path: published → title `${business_name} — Concessionária` + noindex preservado", async () => {
    setSupabaseResponse(makeRow("published"));
    const { generateMetadata } = await import("@/app/sites/[slug]/page");

    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG }),
    });

    expect(meta.title).toBe(`${SITE_FIXTURE.business_name} — Concessionária`);
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.openGraph?.images).toEqual([{ url: SITE_FIXTURE.logo_url }]);
    expect((meta.twitter as { card: string }).card).toBe("summary_large_image");
  });

  it("fallback path: getSite null → APENAS noindex (sem title/OG/Twitter)", async () => {
    setSupabaseResponse(null);
    const { generateMetadata } = await import("@/app/sites/[slug]/page");

    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "nao-existe" }),
    });

    expect(meta).toEqual({ robots: { index: false, follow: false } });
    expect(meta.title).toBeUndefined();
    expect(meta.openGraph).toBeUndefined();
    expect(meta.twitter).toBeUndefined();
  });

  it("fallback path: status='draft' → APENAS noindex", async () => {
    setSupabaseResponse(makeRow("draft"));
    const { generateMetadata } = await import("@/app/sites/[slug]/page");

    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG }),
    });

    expect(meta).toEqual({ robots: { index: false, follow: false } });
  });

  it("fallback path: status='archived' → APENAS noindex", async () => {
    setSupabaseResponse(makeRow("archived"));
    const { generateMetadata } = await import("@/app/sites/[slug]/page");

    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG }),
    });

    expect(meta).toEqual({ robots: { index: false, follow: false } });
  });

  it("fallback path: variables inválido (safeParse falho) → APENAS noindex", async () => {
    const broken = {
      ...SITE_FIXTURE,
      primary_color: "red",
    } as unknown as SiteVariables;
    setSupabaseResponse(makeRow("published", broken));
    const { generateMetadata } = await import("@/app/sites/[slug]/page");

    const meta = await generateMetadata({
      params: Promise.resolve({ slug: SLUG }),
    });

    expect(meta).toEqual({ robots: { index: false, follow: false } });
  });
});
