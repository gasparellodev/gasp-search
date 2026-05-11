/**
 * Testes do `getSite` extraído (`lib/sites/get-site.ts`) — issue #163.
 *
 * Regression-safe: o comportamento aqui é idêntico ao que vivia inline
 * em `app/sites/[slug]/page.tsx` (testado em
 * `tests/unit/app/sites/page.test.tsx`). Esses testes garantem que o
 * helper em si também atende ao contrato (5 status + erro do Supabase),
 * já que agora é chamado por 4+ rotas (`/sites/[slug]`, `/sobre`,
 * `/contato`, `/anunciar`).
 *
 * Smoke migration #203 — usa `createMockSupabaseClient` em vez do
 * chainable inline ad-hoc anterior.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  createMockSupabaseClient,
  type MockSupabaseClient,
  type TableOverride,
} from "@/tests/__mocks__/supabase";

const supabaseMocks = vi.hoisted(() => ({
  serviceClient: vi.fn(),
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

function setSupabaseResponse(
  data: unknown,
  error: unknown = null,
): MockSupabaseClient {
  const override: TableOverride = { maybeSingle: { data, error } };
  const client = createMockSupabaseClient({
    tables: { lead_sites: override },
  });
  supabaseMocks.serviceClient.mockReturnValue(client);
  return client;
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
        signed_at: null,
        visual_identity: null,
      });
      const { getSite } = await import("@/lib/sites/get-site");

      const result = await getSite(SLUG);
      expect(result).toEqual({
        id: SITE_ID,
        slug: SLUG,
        status,
        variables: { foo: "bar" },
        signed_at: null,
        visual_identity: null,
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
    const client = setSupabaseResponse({
      id: SITE_ID,
      slug: SLUG,
      status: "published",
      variables: {},
    });
    const { getSite } = await import("@/lib/sites/get-site");

    await getSite(SLUG);

    expect(client.from).toHaveBeenCalledWith("lead_sites");
    const leadSites = client.builders.lead_sites;
    if (!leadSites) {
      throw new Error("expected lead_sites builder to be tracked");
    }
    expect(leadSites.select).toHaveBeenCalledWith(
      "id, slug, status, variables, signed_at, visual_identity",
    );
    expect(leadSites.eq).toHaveBeenCalledWith("slug", SLUG);
  });

  // ===========================================================================
  // #217 — visual_identity parsing + fallback graceful
  // ===========================================================================
  describe("visual_identity manifest parsing (#217)", () => {
    const VALID_MANIFEST = {
      hero_url: "https://cdn.example.com/touring/hero-ai.png",
      categories_urls: [
        "https://cdn.example.com/touring/sedan.png",
        "https://cdn.example.com/touring/suv.png",
      ],
      about_url: "https://cdn.example.com/touring/about-ai.png",
      contact_url: "https://cdn.example.com/touring/contact-ai.png",
      generated_at: "2026-05-11T07:00:00.000Z",
      model: "gpt-image-2-2026-04-21",
      cost_estimate_brl: 2.45,
    } as const;

    it("retorna `visual_identity: null` quando coluna é null", async () => {
      setSupabaseResponse({
        id: SITE_ID,
        slug: SLUG,
        status: "published",
        variables: { foo: "bar" },
        signed_at: "2026-05-10T00:00:00Z",
        visual_identity: null,
      });
      const { getSite } = await import("@/lib/sites/get-site");

      const result = await getSite(SLUG);
      expect(result?.visual_identity).toBeNull();
    });

    it("retorna manifest parseado quando shape válido", async () => {
      setSupabaseResponse({
        id: SITE_ID,
        slug: SLUG,
        status: "published",
        variables: { foo: "bar" },
        signed_at: "2026-05-10T00:00:00Z",
        visual_identity: VALID_MANIFEST,
      });
      const { getSite } = await import("@/lib/sites/get-site");

      const result = await getSite(SLUG);
      expect(result?.visual_identity).toEqual(VALID_MANIFEST);
    });

    it("retorna `visual_identity: null` quando shape inválido (graceful)", async () => {
      const warnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      setSupabaseResponse({
        id: SITE_ID,
        slug: SLUG,
        status: "published",
        variables: { foo: "bar" },
        signed_at: "2026-05-10T00:00:00Z",
        // Faltando keys obrigatórias (about_url, contact_url, etc.).
        visual_identity: { hero_url: "https://x.com/h.png" },
      });
      const { getSite } = await import("@/lib/sites/get-site");

      const result = await getSite(SLUG);
      expect(result?.visual_identity).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        "getSite:visual_identity:parse_fail",
        expect.objectContaining({ slug: SLUG }),
      );
      warnSpy.mockRestore();
    });
  });
});
