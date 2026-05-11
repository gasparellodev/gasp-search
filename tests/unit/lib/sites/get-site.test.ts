/**
 * Testes do `getSite` extraído (`lib/sites/get-site.ts`) — issue #163.
 *
 * Regression-safe: o comportamento aqui é idêntico ao que vivia inline
 * em `app/sites/[slug]/page.tsx` (testado em
 * `tests/unit/app/sites/page.test.tsx`). Esses testes garantem que o
 * helper em si também atende ao contrato (5 status + erro do Supabase),
 * já que agora é chamado por 4+ rotas (`/sites/[slug]`, `/sobre`,
 * `/contato`, `/anunciar`).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  serviceClient: vi.fn(),
  maybeSingle: vi.fn(),
}));

const cacheMocks = vi.hoisted(() => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabase: supabaseMocks.serviceClient,
}));

vi.mock("next/cache", () => ({
  cacheTag: cacheMocks.cacheTag,
  cacheLife: cacheMocks.cacheLife,
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const SLUG = "j7k2p9-touring-cars";
const SITE_ID = "44444444-4444-4444-8444-444444444444";

function setSupabaseResponse(data: unknown, error: unknown = null) {
  supabaseMocks.maybeSingle.mockResolvedValue({ data, error });
  const eq = vi.fn(() => ({ maybeSingle: supabaseMocks.maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  supabaseMocks.serviceClient.mockReturnValue({ from });
  return { from, select, eq };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSite (lib/sites/get-site.ts)", () => {
  it("retorna `null` quando slug inexistente (Supabase data: null)", async () => {
    setSupabaseResponse(null);
    const { getSite } = await import("@/lib/sites/get-site");

    const result = await getSite("nao-existe");
    expect(result).toBeNull();
  });

  it("retorna `null` quando Supabase retorna error (não vaza erro)", async () => {
    setSupabaseResponse(null, new Error("connection refused"));
    const { getSite } = await import("@/lib/sites/get-site");

    const result = await getSite(SLUG);
    expect(result).toBeNull();
  });

  it.each(["draft", "published", "sent", "archived"] as const)(
    "retorna o row quando status='%s' (caller decide routing)",
    async (status) => {
      setSupabaseResponse({
        id: SITE_ID,
        slug: SLUG,
        status,
        variables: { foo: "bar" },
      });
      const { getSite } = await import("@/lib/sites/get-site");

      const result = await getSite(SLUG);
      expect(result).toEqual({
        id: SITE_ID,
        slug: SLUG,
        status,
        variables: { foo: "bar" },
      });
    },
  );

  it("invoca `cacheTag(`site:${slug}`)` com o slug correto", async () => {
    setSupabaseResponse({
      id: SITE_ID,
      slug: SLUG,
      status: "published",
      variables: {},
    });
    const { getSite } = await import("@/lib/sites/get-site");

    await getSite(SLUG);
    expect(cacheMocks.cacheTag).toHaveBeenCalledWith(`site:${SLUG}`);
  });

  it("invoca `cacheLife({ revalidate: 3600, expire: 86400 })`", async () => {
    setSupabaseResponse({
      id: SITE_ID,
      slug: SLUG,
      status: "published",
      variables: {},
    });
    const { getSite } = await import("@/lib/sites/get-site");

    await getSite(SLUG);
    expect(cacheMocks.cacheLife).toHaveBeenCalledWith({
      revalidate: 3600,
      expire: 86400,
    });
  });

  it("filtra Supabase via `eq('slug', <slug>)`", async () => {
    const handles = setSupabaseResponse({
      id: SITE_ID,
      slug: SLUG,
      status: "published",
      variables: {},
    });
    const { getSite } = await import("@/lib/sites/get-site");

    await getSite(SLUG);
    expect(handles.from).toHaveBeenCalledWith("lead_sites");
    expect(handles.select).toHaveBeenCalledWith(
      "id, slug, status, variables, signed_at",
    );
    expect(handles.eq).toHaveBeenCalledWith("slug", SLUG);
  });
});
