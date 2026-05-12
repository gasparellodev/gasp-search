import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_ENV = {
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  APIFY_TOKEN: "t",
  APIFY_GOOGLE_MAPS_ACTOR_ID: "compass~crawler-google-places",
  APIFY_INSTAGRAM_ACTOR_ID: "apify~instagram-scraper",
  APIFY_WEBSITE_CONTACT_ACTOR_ID: "vdrmota~contact-info-scraper",
  ANTHROPIC_API_KEY: "sk-ant-test",
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
} as const;

let savedEnv: NodeJS.ProcessEnv;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  savedEnv = { ...process.env };
  Object.assign(process.env, VALID_ENV, { INDEXNOW_KEY: "abc123key" });
  vi.resetModules();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 200 })),
  );
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  warnSpy.mockRestore();
  process.env = savedEnv;
});

describe("notifyIndexNow", () => {
  it("envia POST batch para os 4 endpoints em chunks de 10 URLs", async () => {
    const { notifyIndexNow } = await import("@/lib/seo/indexnow");
    const urls = Array.from(
      { length: 11 },
      (_, i) => `https://app.example.com/sites/loja/page-${i + 1}`,
    );

    await notifyIndexNow(urls);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.indexnow.org/indexnow",
      "https://www.bing.com/indexnow",
      "https://yandex.com/indexnow",
      "https://searchadvisor.naver.com/indexnow",
      "https://api.indexnow.org/indexnow",
      "https://www.bing.com/indexnow",
      "https://yandex.com/indexnow",
      "https://searchadvisor.naver.com/indexnow",
    ]);

    const firstBody = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(firstBody).toEqual({
      host: "app.example.com",
      key: "abc123key",
      keyLocation: "https://app.example.com/abc123key.txt",
      urlList: urls.slice(0, 10),
    });
  });

  it("deduplica URLs e ignora entradas inválidas", async () => {
    const { notifyIndexNow } = await import("@/lib/seo/indexnow");

    await notifyIndexNow([
      "https://app.example.com/sites/loja",
      "https://app.example.com/sites/loja",
      "not-a-url",
    ]);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
    ) as { urlList: string[] };
    expect(body.urlList).toEqual(["https://app.example.com/sites/loja"]);
  });

  it("falha silenciosamente com console.warn quando endpoint rejeita", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad", { status: 500 })),
    );
    const { notifyIndexNow } = await import("@/lib/seo/indexnow");

    await expect(
      notifyIndexNow(["https://app.example.com/sites/loja"]),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "indexnow:notify_failed",
      expect.objectContaining({ status: 500 }),
    );
  });

  it("sem INDEXNOW_KEY vira no-op com warning", async () => {
    delete process.env.INDEXNOW_KEY;
    vi.resetModules();
    const { notifyIndexNow } = await import("@/lib/seo/indexnow");

    await notifyIndexNow(["https://app.example.com/sites/loja"]);

    expect(fetch).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith("indexnow:missing_key");
  });
});
