/**
 * Testes do route handler `app/sites/[slug]/llms.txt/route.ts`
 * (issue #214 / Sprint 1 / #S4).
 *
 * Foco: gate de visibilidade (`isIndexable`) com 404 `text/plain` em
 * TODOS os paths de erro (não usar `notFound()` default que emite HTML)
 * e happy path 200 + Content-Type `text/plain; charset=utf-8`.
 *
 * Diferente de `opengraph-image` (#213) — llms.txt expõe contato
 * comercial direto (privacy by obscurity). Cada gate falho retorna 404
 * com header text/plain explícito para AI crawlers parsearem corretamente.
 *
 * Cache: ISR via `export const revalidate = 3600`. NÃO chamamos
 * `cacheTag` no handler (Next 16 exige dentro de `"use cache"`, e
 * `"use cache"` quebra com `Response`). Invalidação flui via
 * `getSite()` que tem `"use cache"` + `cacheTag('site:<slug>')`
 * internamente — os 5 callsites de `updateTag('site:<slug>')` em
 * `app/actions/lead-site.ts` cobrem o cenário.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { SiteVariablesV2 } from "@/types/lead-site";

import { SITE_FIXTURE } from "../../../../components/sites/site-fixtures";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const getSiteMock = vi.hoisted(() => vi.fn());
const cacheMocks = vi.hoisted(() => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

vi.mock("@/lib/sites/get-site", () => ({
  getSite: getSiteMock,
}));

vi.mock("next/cache", () => ({
  cacheTag: cacheMocks.cacheTag,
  cacheLife: cacheMocks.cacheLife,
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SITE_ID = "55555555-5555-5555-8555-555555555555";
const SLUG = "j7k2p9-touring-cars";
const SIGNED_AT = "2026-05-10T00:00:00Z";

function makeRow(opts: {
  status?: "draft" | "published" | "sent" | "archived";
  variables?: SiteVariablesV2;
  signed_at?: string | null;
} = {}) {
  return {
    id: SITE_ID,
    slug: SLUG,
    status: opts.status ?? "published",
    variables: opts.variables ?? SITE_FIXTURE,
    signed_at: "signed_at" in opts ? (opts.signed_at ?? null) : SIGNED_AT,
    visual_identity: null,
  };
}

async function callRoute(slug: string): Promise<Response> {
  const mod = await import("@/app/sites/[slug]/llms.txt/route");
  return mod.GET(new Request(`http://localhost/sites/${slug}/llms.txt`), {
    params: Promise.resolve({ slug }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// Gate de visibilidade
// ===========================================================================

describe("llms.txt route — gate isIndexable", () => {
  it("getSite null → 404 com Content-Type text/plain", async () => {
    getSiteMock.mockResolvedValue(null);
    const res = await callRoute(SLUG);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("content-type")).toContain("charset=utf-8");
  });

  it("status='draft' → 404 text/plain (não vaza preview)", async () => {
    getSiteMock.mockResolvedValue(makeRow({ status: "draft" }));
    const res = await callRoute(SLUG);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/plain");
  });

  it("status='archived' → 404 text/plain", async () => {
    getSiteMock.mockResolvedValue(makeRow({ status: "archived" }));
    const res = await callRoute(SLUG);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/plain");
  });

  it("status='published' mas signed_at=null → 404 text/plain", async () => {
    getSiteMock.mockResolvedValue(
      makeRow({ status: "published", signed_at: null }),
    );
    const res = await callRoute(SLUG);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/plain");
  });

  it("variables inválido (Zod safeParse fail) → 404 text/plain", async () => {
    getSiteMock.mockResolvedValue({
      id: SITE_ID,
      slug: SLUG,
      status: "published",
      signed_at: SIGNED_AT,
      variables: { foo: "bar" },
    });
    const res = await callRoute(SLUG);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/plain");
  });

  it("404 sempre emite body 'Not Found' (parsing AI crawler estável)", async () => {
    getSiteMock.mockResolvedValue(null);
    const res = await callRoute(SLUG);
    const body = await res.text();
    expect(body).toBe("Not Found");
  });
});

// ===========================================================================
// Happy path
// ===========================================================================

describe("llms.txt route — happy path", () => {
  it("status='published' + signed → 200 text/plain com body Markdown", async () => {
    getSiteMock.mockResolvedValue(makeRow({ status: "published" }));
    const res = await callRoute(SLUG);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("content-type")).toContain("charset=utf-8");

    const body = await res.text();
    expect(body).toContain(`# ${SITE_FIXTURE.business_name}`);
    expect(body).toContain("## Sobre");
    expect(body).toContain("## Estoque (snapshot)");
    expect(body).toContain("## Contato");
  });

  it("status='sent' + signed → 200 (sent é renderizável)", async () => {
    getSiteMock.mockResolvedValue(makeRow({ status: "sent" }));
    const res = await callRoute(SLUG);
    expect(res.status).toBe(200);
  });

  it("emite header Cache-Control com max-age e SWR", async () => {
    getSiteMock.mockResolvedValue(makeRow({ status: "published" }));
    const res = await callRoute(SLUG);
    const cacheControl = res.headers.get("cache-control");
    expect(cacheControl).toBeTruthy();
    expect(cacheControl).toContain("max-age=3600");
    expect(cacheControl).toContain("s-maxage=3600");
    expect(cacheControl).toContain("stale-while-revalidate=86400");
  });

  it("NÃO chama cacheTag no handler — invalidação flui via getSite() (PR #246 fix)", async () => {
    // Next 16 exige `cacheTag` dentro de `"use cache"`, que não podemos
    // usar em Route Handlers retornando `Response`. Em vez de chamar
    // `cacheTag` no handler (que crasharia com `Error: 'cacheTag()' can
    // only be called inside a "use cache" function`), confiamos no
    // `cacheTag('site:<slug>')` interno do `getSite()`. Os 5 callsites
    // de `updateTag('site:<slug>')` em `app/actions/lead-site.ts`
    // invalidam transitivamente.
    getSiteMock.mockResolvedValue(makeRow({ status: "published" }));
    await callRoute(SLUG);
    expect(cacheMocks.cacheTag).not.toHaveBeenCalled();
    expect(cacheMocks.cacheLife).not.toHaveBeenCalled();
  });
});
