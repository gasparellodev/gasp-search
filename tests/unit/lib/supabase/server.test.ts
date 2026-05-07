import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_ENV = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  APIFY_TOKEN: "t",
  APIFY_GOOGLE_MAPS_ACTOR_ID: "a",
  APIFY_INSTAGRAM_ACTOR_ID: "b",
  APIFY_WEBSITE_CONTACT_ACTOR_ID: "c",
  ANTHROPIC_API_KEY: "k",
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
} as const;

let savedEnv: NodeJS.ProcessEnv;

const cookieMock = vi.hoisted(() => ({
  getAll: vi.fn(() => [{ name: "sb-access", value: "abc" }]),
  set: vi.fn(),
}));

const supabaseFactory = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieMock),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: supabaseFactory,
}));

beforeEach(() => {
  savedEnv = { ...process.env };
  Object.assign(process.env, VALID_ENV);
  cookieMock.getAll.mockClear();
  cookieMock.set.mockClear();
  supabaseFactory.mockReset();
  supabaseFactory.mockReturnValue({ marker: "supabase-instance" });
  vi.resetModules();
});

afterEach(() => {
  process.env = savedEnv;
  vi.resetModules();
});

describe("lib/supabase/server", () => {
  it("createServerSupabase passa URL, anon key e cookies handler para createServerClient", async () => {
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const client = await createServerSupabase();
    expect(client).toEqual({ marker: "supabase-instance" });
    expect(supabaseFactory).toHaveBeenCalledTimes(1);
    const [url, key, opts] = supabaseFactory.mock.calls[0]!;
    expect(url).toBe("https://abc.supabase.co");
    expect(key).toBe("anon");
    expect(opts).toMatchObject({
      cookies: expect.objectContaining({
        getAll: expect.any(Function),
        setAll: expect.any(Function),
      }),
    });
  });

  it("cookies.getAll do client retorna o resultado de cookieStore.getAll()", async () => {
    const { createServerSupabase } = await import("@/lib/supabase/server");
    await createServerSupabase();
    const opts = supabaseFactory.mock.calls[0]![2] as {
      cookies: { getAll: () => unknown };
    };
    const all = opts.cookies.getAll();
    expect(all).toEqual([{ name: "sb-access", value: "abc" }]);
    expect(cookieMock.getAll).toHaveBeenCalled();
  });

  it("cookies.setAll chama cookieStore.set com nome+valor+options", async () => {
    const { createServerSupabase } = await import("@/lib/supabase/server");
    await createServerSupabase();
    const opts = supabaseFactory.mock.calls[0]![2] as {
      cookies: {
        setAll: (
          xs: { name: string; value: string; options: { path: string } }[],
        ) => void;
      };
    };
    opts.cookies.setAll([
      { name: "k", value: "v", options: { path: "/" } },
    ]);
    expect(cookieMock.set).toHaveBeenCalledWith("k", "v", { path: "/" });
  });

  it("cookies.setAll engole erro de cookieStore.set (Server Component read-only)", async () => {
    cookieMock.set.mockImplementationOnce(() => {
      throw new Error("read only");
    });
    const { createServerSupabase } = await import("@/lib/supabase/server");
    await createServerSupabase();
    const opts = supabaseFactory.mock.calls[0]![2] as {
      cookies: {
        setAll: (
          xs: { name: string; value: string; options: { path: string } }[],
        ) => void;
      };
    };
    expect(() =>
      opts.cookies.setAll([
        { name: "k", value: "v", options: { path: "/" } },
      ]),
    ).not.toThrow();
  });
});
