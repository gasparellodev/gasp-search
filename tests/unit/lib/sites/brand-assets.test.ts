/**
 * Testes do pipeline `extractBrandAssets` (issue #156).
 *
 * Mocks externos:
 * - `apify-client` (Instagram + Maps actors)
 * - `global.fetch` (favicon scraper)
 * - `node-vibrant` (color palette extraction)
 * - `@vercel/blob` (`put` / `del` upload)
 *
 * Nenhum teste faz request real (AC7).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database";

// ---------------------------------------------------------------------------
// Test env (mirrored from generate-copy.test.ts — same VALID_ENV pattern)
// ---------------------------------------------------------------------------

const VALID_ENV = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  APIFY_TOKEN: "t",
  APIFY_GOOGLE_MAPS_ACTOR_ID: "compass~crawler-google-places",
  APIFY_INSTAGRAM_ACTOR_ID: "apify~instagram-scraper",
  APIFY_WEBSITE_CONTACT_ACTOR_ID: "vdrmota~contact-info-scraper",
  ANTHROPIC_API_KEY: "sk-ant-test",
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_test_token",
} as const;

// ---------------------------------------------------------------------------
// Apify mock — actor().call() returns { defaultDatasetId } and
// dataset().listItems() returns { items: [...] }.
// ---------------------------------------------------------------------------

type AsyncFn = (...args: unknown[]) => Promise<unknown>;

interface ApifyState {
  igCall: ReturnType<typeof vi.fn<AsyncFn>>;
  igListItems: ReturnType<typeof vi.fn<AsyncFn>>;
  mapsCall: ReturnType<typeof vi.fn<AsyncFn>>;
  mapsListItems: ReturnType<typeof vi.fn<AsyncFn>>;
}

const apifyMock = vi.hoisted<() => ApifyState>(() => () => ({
  igCall: vi.fn<AsyncFn>(),
  igListItems: vi.fn<AsyncFn>(),
  mapsCall: vi.fn<AsyncFn>(),
  mapsListItems: vi.fn<AsyncFn>(),
}));

const apifyState = apifyMock();

vi.mock("apify-client", () => {
  class ApifyClient {
    constructor(_options: unknown) {
      void _options;
    }
    actor(actorId: string) {
      const isMaps = actorId.includes("google-places");
      return {
        call: isMaps ? apifyState.mapsCall : apifyState.igCall,
      };
    }
    dataset(_datasetId: string) {
      void _datasetId;
      // Returns last-called dataset items; tests stub listItems explicitly via
      // mocks resetted before each test.
      return {
        listItems: async () => {
          // Heuristic: prefer maps if its mock is configured this turn.
          if (apifyState.mapsListItems.mock.calls.length === 0 &&
              apifyState.mapsListItems.getMockImplementation()) {
            return apifyState.mapsListItems();
          }
          if (apifyState.igListItems.getMockImplementation()) {
            return apifyState.igListItems();
          }
          // Default: try maps first.
          return apifyState.mapsListItems();
        },
      };
    }
  }
  return { ApifyClient };
});

// ---------------------------------------------------------------------------
// node-vibrant mock — Vibrant.from(url).getPalette() returns Palette
// ---------------------------------------------------------------------------

interface VibrantState {
  fromMock: ReturnType<typeof vi.fn<(src: string) => void>>;
  getPaletteMock: ReturnType<typeof vi.fn<AsyncFn>>;
}

const vibrantMock = vi.hoisted<() => VibrantState>(() => () => ({
  fromMock: vi.fn<(src: string) => void>(),
  getPaletteMock: vi.fn<AsyncFn>(),
}));

const vibrantState = vibrantMock();

vi.mock("node-vibrant", () => {
  const Vibrant = {
    from: (src: string) => {
      vibrantState.fromMock(src);
      return {
        getPalette: vibrantState.getPaletteMock,
      };
    },
  };
  return { default: Vibrant };
});

// ---------------------------------------------------------------------------
// @vercel/blob mock — put returns { url }, del returns void
// ---------------------------------------------------------------------------

interface BlobState {
  putMock: ReturnType<typeof vi.fn<AsyncFn>>;
  delMock: ReturnType<typeof vi.fn<AsyncFn>>;
}

const blobMock = vi.hoisted<() => BlobState>(() => () => ({
  putMock: vi.fn<AsyncFn>(),
  delMock: vi.fn<AsyncFn>(),
}));

const blobState = blobMock();

vi.mock("@vercel/blob", () => ({
  put: blobState.putMock,
  del: blobState.delMock,
}));

// ---------------------------------------------------------------------------
// Lead fixture helper
// ---------------------------------------------------------------------------

type Lead = Database["public"]["Tables"]["leads"]["Row"];

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-test-id",
    user_id: "user-1",
    source: "google_maps",
    source_search_job_id: null,
    name: "Acme Motors",
    category: null,
    city: null,
    state: null,
    country: null,
    phone: null,
    email: null,
    website: null,
    instagram_handle: null,
    whatsapp: null,
    has_website: null,
    rating: null,
    reviews_count: null,
    followers_count: null,
    stage: "new",
    score: 0,
    notes: null,
    raw: null,
    enriched_at: null,
    created_at: "2026-05-08T00:00:00Z",
    updated_at: "2026-05-08T00:00:00Z",
    ...overrides,
  } as Lead;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  Object.assign(process.env, VALID_ENV);
  apifyState.igCall.mockReset();
  apifyState.igListItems.mockReset();
  apifyState.mapsCall.mockReset();
  apifyState.mapsListItems.mockReset();
  vibrantState.fromMock.mockReset();
  vibrantState.getPaletteMock.mockReset();
  blobState.putMock.mockReset();
  blobState.delMock.mockReset();
  vi.unstubAllGlobals();
  vi.resetModules();
});

afterEach(() => {
  process.env = savedEnv;
  vi.unstubAllGlobals();
  vi.resetModules();
});

// ===========================================================================
// extractBrandAssets — happy paths and shape contract (AC1)
// ===========================================================================

describe("extractBrandAssets — contract", () => {
  it("retorna AssetSources com primary_color matching /^#[0-9a-f]{6}$/i", async () => {
    blobState.putMock.mockResolvedValue({ url: "https://blob.test/logo.svg" });
    apifyState.igCall.mockRejectedValue(new Error("no instagram"));
    apifyState.mapsCall.mockRejectedValue(new Error("no maps"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "<html></html>",
      }),
    );
    vibrantState.getPaletteMock.mockResolvedValue({});

    const { extractBrandAssets } = await import("@/lib/sites/brand-assets");
    const result = await extractBrandAssets(makeLead());

    expect(result.primary_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(["#FFFFFF", "#0C0C0C"]).toContain(result.text_on_primary);
    expect(result.car_placeholder_urls).toHaveLength(6);
    expect(typeof result.logo_url).toBe("string");
    expect(result.logo_url.length).toBeGreaterThan(0);
    expect(typeof result.hero_image_url).toBe("string");
    expect(typeof result.about_image_url).toBe("string");
    expect(typeof result.contact_hero_image_url).toBe("string");
  });
});

// ===========================================================================
// AC2 — Pipeline nunca falha (resilience)
// ===========================================================================

describe("extractBrandAssets — resilience (AC2)", () => {
  it("lead vazio (só business_name) → AssetSources válido com fallback total", async () => {
    blobState.putMock.mockRejectedValue(new Error("blob upload error"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    vibrantState.getPaletteMock.mockRejectedValue(new Error("vibrant fail"));

    const { extractBrandAssets } = await import("@/lib/sites/brand-assets");
    const result = await extractBrandAssets(
      makeLead({ name: "Acme", website: null, instagram_handle: null }),
    );

    expect(result.primary_color).toBe("#000000");
    expect(result.text_on_primary).toBe("#FFFFFF");
    expect(result.logo_url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(result.car_placeholder_urls).toHaveLength(6);
    expect(result.hero_image_url).toMatch(/^\/assets\//);
    expect(result.about_image_url).toMatch(/^\/assets\//);
    expect(result.contact_hero_image_url).toMatch(/^\/assets\//);
  });

  it("Apify Instagram falha (throws) → cascata avança sem propagar", async () => {
    apifyState.igCall.mockRejectedValue(new Error("apify ig down"));
    apifyState.mapsCall.mockRejectedValue(new Error("apify maps down"));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    blobState.putMock.mockResolvedValue({ url: "https://blob.test/logo.svg" });
    vibrantState.getPaletteMock.mockResolvedValue({});

    const { extractBrandAssets } = await import("@/lib/sites/brand-assets");
    const result = await extractBrandAssets(
      makeLead({ instagram_handle: "acme" }),
    );

    expect(result.logo_url).toBe("https://blob.test/logo.svg");
  });

  it("fetch timeout em tryWebsiteFavicon → cascata avança (não throws)", async () => {
    apifyState.igCall.mockRejectedValue(new Error("no ig"));
    apifyState.mapsCall.mockRejectedValue(new Error("no maps"));

    vi.useFakeTimers();
    // fetch que respeita AbortSignal — abort dispara DOMException com name
    // 'AbortError' (Node fetch) → tryWebsiteFavicon retorna null.
    const abortableFetch = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );
    vi.stubGlobal("fetch", abortableFetch);
    blobState.putMock.mockResolvedValue({ url: "https://blob.test/m.svg" });
    vibrantState.getPaletteMock.mockResolvedValue({});

    const { extractBrandAssets } = await import("@/lib/sites/brand-assets");
    const promise = extractBrandAssets(
      makeLead({ website: "https://acme.com.br" }),
    );
    // Avança o timeout pra disparar o abort e desbloquear o pipeline.
    await vi.advanceTimersByTimeAsync(6_000);
    const result = await promise;
    vi.useRealTimers();

    // Deve cair no monogram (cascata não retornou favicon).
    expect(result.logo_url).toBe("https://blob.test/m.svg");
  });

  it("Vibrant lança erro → primary_color = #000000, text_on_primary = #FFFFFF", async () => {
    apifyState.igCall.mockRejectedValue(new Error("no"));
    apifyState.mapsCall.mockRejectedValue(new Error("no"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    blobState.putMock.mockResolvedValue({ url: "https://blob.test/m.svg" });
    vibrantState.getPaletteMock.mockRejectedValue(new Error("vibrant kaboom"));

    const { extractBrandAssets } = await import("@/lib/sites/brand-assets");
    const result = await extractBrandAssets(makeLead());

    expect(result.primary_color).toBe("#000000");
    expect(result.text_on_primary).toBe("#FFFFFF");
  });

  it("fetchMapsPhotos retorna [] → photos completados de stock até 3", async () => {
    apifyState.igCall.mockRejectedValue(new Error("no ig"));
    apifyState.mapsCall.mockResolvedValue({ defaultDatasetId: "ds-1" });
    apifyState.mapsListItems.mockResolvedValue({ items: [{ imageUrls: [] }] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    blobState.putMock.mockResolvedValue({ url: "https://blob.test/m.svg" });
    vibrantState.getPaletteMock.mockResolvedValue({});

    const { extractBrandAssets } = await import("@/lib/sites/brand-assets");
    const result = await extractBrandAssets(
      makeLead({ raw: { placeId: "ChIJ-test" } as never }),
    );

    expect(result.hero_image_url).toMatch(/^\/assets\//);
    expect(result.about_image_url).toMatch(/^\/assets\//);
    expect(result.contact_hero_image_url).toMatch(/^\/assets\//);
  });

  it("fetchMapsPhotos retorna 1 photo → 2 photos completados de stock", async () => {
    apifyState.igCall.mockRejectedValue(new Error("no ig"));
    apifyState.mapsCall.mockResolvedValue({ defaultDatasetId: "ds-1" });
    apifyState.mapsListItems.mockResolvedValue({
      items: [{ imageUrls: ["https://maps.googleusercontent.com/p/AF1.jpg"] }],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    blobState.putMock.mockResolvedValue({ url: "https://blob.test/m.svg" });
    vibrantState.getPaletteMock.mockResolvedValue({});

    const { extractBrandAssets } = await import("@/lib/sites/brand-assets");
    const result = await extractBrandAssets(
      makeLead({ raw: { placeId: "ChIJ-test" } as never }),
    );

    expect(result.hero_image_url).toBe(
      "https://maps.googleusercontent.com/p/AF1.jpg",
    );
    // about + contact vêm do stock.
    expect(result.about_image_url).toMatch(/^\/assets\//);
    expect(result.contact_hero_image_url).toMatch(/^\/assets\//);
  });

  it("@vercel/blob falha em buildMonogramLogo → retorna data URI fallback (não throws)", async () => {
    apifyState.igCall.mockRejectedValue(new Error("no"));
    apifyState.mapsCall.mockRejectedValue(new Error("no"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    blobState.putMock.mockRejectedValue(new Error("blob 500"));
    vibrantState.getPaletteMock.mockResolvedValue({});

    const { extractBrandAssets } = await import("@/lib/sites/brand-assets");
    const result = await extractBrandAssets(makeLead());

    expect(result.logo_url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    // Decodifica e verifica conteúdo SVG válido.
    const base64 = result.logo_url.replace("data:image/svg+xml;base64,", "");
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    expect(decoded).toContain("<svg");
    expect(decoded).toContain("256");
  });
});

// ===========================================================================
// AC3 — tryWebsiteFavicon detalhado
// ===========================================================================

describe("tryWebsiteFavicon (AC3)", () => {
  it("null URL → retorna null sem fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { tryWebsiteFavicon } = await import("@/lib/sites/brand-assets");
    const result = await tryWebsiteFavicon(null);

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('200 + <link rel="icon" href="/favicon.ico"> → resolve URL absoluta', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          '<html><head><link rel="icon" href="/favicon.ico"></head></html>',
      }),
    );

    const { tryWebsiteFavicon } = await import("@/lib/sites/brand-assets");
    const result = await tryWebsiteFavicon("https://acme.com.br");

    expect(result).toBe("https://acme.com.br/favicon.ico");
  });

  it('rel="shortcut icon" com URL absoluta → retorna direta', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          '<html><head><link rel="shortcut icon" href="https://cdn.x/icon.png"></head></html>',
      }),
    );

    const { tryWebsiteFavicon } = await import("@/lib/sites/brand-assets");
    const result = await tryWebsiteFavicon("https://acme.com.br");

    expect(result).toBe("https://cdn.x/icon.png");
  });

  it("HTML sem <link> → retorna null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "<html><head><title>no icon</title></head></html>",
      }),
    );

    const { tryWebsiteFavicon } = await import("@/lib/sites/brand-assets");
    const result = await tryWebsiteFavicon("https://acme.com.br");

    expect(result).toBeNull();
  });

  it("timeout via AbortController → retorna null sem throw", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { tryWebsiteFavicon } = await import("@/lib/sites/brand-assets");
    const promise = tryWebsiteFavicon("https://acme.com.br");
    await vi.advanceTimersByTimeAsync(6_000);
    const result = await promise;
    vi.useRealTimers();

    expect(result).toBeNull();
  });

  it("network error → retorna null sem throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ENOTFOUND")));

    const { tryWebsiteFavicon } = await import("@/lib/sites/brand-assets");
    const result = await tryWebsiteFavicon("https://acme.com.br");

    expect(result).toBeNull();
  });

  it("URL sem schema (legacy normalized) → adiciona https://", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          '<html><head><link rel="icon" href="/favicon.ico"></head></html>',
      }),
    );

    const { tryWebsiteFavicon } = await import("@/lib/sites/brand-assets");
    const result = await tryWebsiteFavicon("acme.com.br");

    expect(result).toBe("https://acme.com.br/favicon.ico");
  });
});

// ===========================================================================
// AC4 — wcagContrast
// ===========================================================================

describe("wcagContrast (AC4)", () => {
  it("'#000000' → '#FFFFFF' (high contrast)", async () => {
    const { wcagContrast } = await import("@/lib/sites/brand-assets");
    expect(wcagContrast("#000000")).toBe("#FFFFFF");
  });

  it("'#FFFFFF' → '#0C0C0C' (low contrast com white)", async () => {
    const { wcagContrast } = await import("@/lib/sites/brand-assets");
    expect(wcagContrast("#FFFFFF")).toBe("#0C0C0C");
  });

  it("'#fff700' (yellow) → '#0C0C0C'", async () => {
    const { wcagContrast } = await import("@/lib/sites/brand-assets");
    expect(wcagContrast("#fff700")).toBe("#0C0C0C");
  });

  it("'#1a1a1a' → '#FFFFFF'", async () => {
    const { wcagContrast } = await import("@/lib/sites/brand-assets");
    expect(wcagContrast("#1a1a1a")).toBe("#FFFFFF");
  });

  it("'#7d8eff' → escolha mantém contraste WCAG AA ≥ 4.5", async () => {
    const { wcagContrast, contrastRatio } = await import(
      "@/lib/sites/brand-assets"
    );
    const choice = wcagContrast("#7d8eff");
    expect(["#FFFFFF", "#0C0C0C"]).toContain(choice);
    expect(contrastRatio("#7d8eff", choice)).toBeGreaterThanOrEqual(4.5);
  });
});

// ===========================================================================
// AC5 — buildMonogramLogo
// ===========================================================================

describe("buildMonogramLogo (AC5)", () => {
  it("'Toyota Recife' → SVG 256×256 com letras 'TR' centradas", async () => {
    blobState.putMock.mockResolvedValue({
      url: "https://blob.test/monogram-toyota-recife.svg",
    });

    const { buildMonogramLogo } = await import("@/lib/sites/brand-assets");
    const url = await buildMonogramLogo("Toyota Recife", "#ff0000");

    expect(url).toBe("https://blob.test/monogram-toyota-recife.svg");
    expect(blobState.putMock).toHaveBeenCalledOnce();
    const [pathArg, body] = blobState.putMock.mock.calls[0]!;
    expect(typeof pathArg).toBe("string");
    expect(pathArg).toContain("toyota-recife");
    const svg = String(body);
    expect(svg).toContain("256");
    expect(svg).toContain("TR");
  });

  it("'Concessionária' (1 palavra) → 'CO' (2 primeiras letras)", async () => {
    blobState.putMock.mockResolvedValue({
      url: "https://blob.test/monogram-concessionaria.svg",
    });
    const { buildMonogramLogo } = await import("@/lib/sites/brand-assets");
    await buildMonogramLogo("Concessionária", "#000000");
    const svg = String(blobState.putMock.mock.calls[0]![1]);
    expect(svg).toContain("CO");
  });

  it("'Auto Center do Brasil' → 'AC' (skip stopword 'do')", async () => {
    blobState.putMock.mockResolvedValue({
      url: "https://blob.test/monogram.svg",
    });
    const { buildMonogramLogo } = await import("@/lib/sites/brand-assets");
    await buildMonogramLogo("Auto Center do Brasil", "#000000");
    const svg = String(blobState.putMock.mock.calls[0]![1]);
    expect(svg).toContain("AC");
  });

  it("'J & K Motors' → 'JK' (skip '&' não-letra)", async () => {
    blobState.putMock.mockResolvedValue({
      url: "https://blob.test/monogram.svg",
    });
    const { buildMonogramLogo } = await import("@/lib/sites/brand-assets");
    await buildMonogramLogo("J & K Motors", "#000000");
    const svg = String(blobState.putMock.mock.calls[0]![1]);
    expect(svg).toContain("JK");
  });

  it("path determinístico: mesmo input → mesmo path no put()", async () => {
    blobState.putMock.mockResolvedValue({
      url: "https://blob.test/monogram-toyota-recife.svg",
    });
    const { buildMonogramLogo } = await import("@/lib/sites/brand-assets");

    await buildMonogramLogo("Toyota Recife", "#ff0000");
    await buildMonogramLogo("Toyota Recife", "#ff0000");

    expect(blobState.putMock.mock.calls).toHaveLength(2);
    const path1 = blobState.putMock.mock.calls[0]![0];
    const path2 = blobState.putMock.mock.calls[1]![0];
    expect(path1).toBe(path2);
  });

  it("Blob falha → retorna data URI base64 sem throw", async () => {
    blobState.putMock.mockRejectedValue(new Error("blob 500"));
    const { buildMonogramLogo } = await import("@/lib/sites/brand-assets");

    const url = await buildMonogramLogo("Acme", "#000000");

    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const base64 = url.replace("data:image/svg+xml;base64,", "");
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    expect(decoded).toContain("<svg");
    expect(decoded).toContain("AC");
  });
});

// ===========================================================================
// AC6 — pickAccent
// ===========================================================================

describe("pickAccent (AC6)", () => {
  it("palette com 3 swatches → mais saturada × population", async () => {
    const { pickAccent } = await import("@/lib/sites/brand-assets");

    // Vibrant Swatch shape: getHex(), getPopulation(), getHsl() → [h,s,l]
    const palette = {
      Vibrant: {
        getHex: () => "#aaccff",
        getPopulation: () => 100,
        getHsl: () => [0.6, 0.5, 0.7] as [number, number, number],
      },
      DarkVibrant: {
        getHex: () => "#003366",
        getPopulation: () => 50,
        getHsl: () => [0.6, 0.9, 0.2] as [number, number, number],
      },
      Muted: {
        getHex: () => "#998877",
        getPopulation: () => 30,
        getHsl: () => [0.1, 0.2, 0.5] as [number, number, number],
      },
    };

    const result = pickAccent(palette as never);
    // Vibrant: 100 * 0.5 = 50; DarkVibrant: 50 * 0.9 = 45; Muted: 30 * 0.2 = 6.
    expect(result).toBe("#aaccff");
  });

  it("palette vazio ({}) → '#000000'", async () => {
    const { pickAccent } = await import("@/lib/sites/brand-assets");
    expect(pickAccent({} as never)).toBe("#000000");
  });

  it("palette com swatches null → '#000000'", async () => {
    const { pickAccent } = await import("@/lib/sites/brand-assets");
    expect(
      pickAccent({
        Vibrant: undefined,
        Muted: undefined,
      } as never),
    ).toBe("#000000");
  });

  it("output sempre lowercase 6-digit", async () => {
    const { pickAccent } = await import("@/lib/sites/brand-assets");
    const palette = {
      Vibrant: {
        getHex: () => "#AABBCC",
        getPopulation: () => 100,
        getHsl: () => [0, 0.5, 0.5] as [number, number, number],
      },
    };
    const result = pickAccent(palette as never);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
    expect(result).toBe(result.toLowerCase());
  });
});

// ===========================================================================
// Cobertura adicional — caminhos da cascata logo (helpers exportados)
// ===========================================================================

describe("cascata logo — helpers individuais", () => {
  it("tryInstagramAvatar com handle null → retorna null sem chamar Apify", async () => {
    const { tryInstagramAvatar } = await import("@/lib/sites/brand-assets");
    const result = await tryInstagramAvatar(null);
    expect(result).toBeNull();
    expect(apifyState.igCall).not.toHaveBeenCalled();
  });

  it("tryInstagramAvatar com handle válido + Apify ok → retorna profilePicUrl", async () => {
    apifyState.igCall.mockResolvedValue({ defaultDatasetId: "ds-ig" });
    apifyState.igListItems.mockResolvedValue({
      items: [
        {
          username: "acme",
          profilePicUrl: "https://instagram.fxxx.fbcdn.net/avatar.jpg",
        },
      ],
    });

    const { tryInstagramAvatar } = await import("@/lib/sites/brand-assets");
    const result = await tryInstagramAvatar("acme");
    expect(result).toBe("https://instagram.fxxx.fbcdn.net/avatar.jpg");
  });

  it("tryInstagramAvatar com Apify falhando → retorna null", async () => {
    apifyState.igCall.mockRejectedValue(new Error("apify error"));

    const { tryInstagramAvatar } = await import("@/lib/sites/brand-assets");
    const result = await tryInstagramAvatar("acme");
    expect(result).toBeNull();
  });

  it("tryInstagramAvatar com items vazios → retorna null", async () => {
    apifyState.igCall.mockResolvedValue({ defaultDatasetId: "ds-ig" });
    apifyState.igListItems.mockResolvedValue({ items: [] });

    const { tryInstagramAvatar } = await import("@/lib/sites/brand-assets");
    const result = await tryInstagramAvatar("acme");
    expect(result).toBeNull();
  });

  it("tryGoogleMapsProfilePhoto com placeId null → retorna null sem chamar Apify", async () => {
    const { tryGoogleMapsProfilePhoto } = await import(
      "@/lib/sites/brand-assets"
    );
    const result = await tryGoogleMapsProfilePhoto(null);
    expect(result).toBeNull();
    expect(apifyState.mapsCall).not.toHaveBeenCalled();
  });

  it("tryGoogleMapsProfilePhoto com placeId válido + Apify ok → retorna primeira foto", async () => {
    apifyState.mapsCall.mockResolvedValue({ defaultDatasetId: "ds-maps" });
    apifyState.mapsListItems.mockResolvedValue({
      items: [
        {
          imageUrls: [
            "https://maps.googleusercontent.com/p/AF1.jpg",
            "https://maps.googleusercontent.com/p/AF2.jpg",
          ],
        },
      ],
    });

    const { tryGoogleMapsProfilePhoto } = await import(
      "@/lib/sites/brand-assets"
    );
    const result = await tryGoogleMapsProfilePhoto("ChIJ-test");
    expect(result).toBe("https://maps.googleusercontent.com/p/AF1.jpg");
  });

  it("fetchMapsPhotos com placeId null → retorna []", async () => {
    const { fetchMapsPhotos } = await import("@/lib/sites/brand-assets");
    const result = await fetchMapsPhotos(null, 3);
    expect(result).toEqual([]);
  });

  it("fetchMapsPhotos com Apify ok → retorna URLs limitadas a count", async () => {
    apifyState.mapsCall.mockResolvedValue({ defaultDatasetId: "ds-maps-2" });
    apifyState.mapsListItems.mockResolvedValue({
      items: [
        {
          imageUrls: [
            "https://maps.googleusercontent.com/p/A.jpg",
            "https://maps.googleusercontent.com/p/B.jpg",
            "https://maps.googleusercontent.com/p/C.jpg",
            "https://maps.googleusercontent.com/p/D.jpg",
          ],
        },
      ],
    });

    const { fetchMapsPhotos } = await import("@/lib/sites/brand-assets");
    const result = await fetchMapsPhotos("ChIJ-test", 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("https://maps.googleusercontent.com/p/A.jpg");
  });
});

// ===========================================================================
// stockShowroomPhotos — constante
// ===========================================================================

describe("stockShowroomPhotos", () => {
  it("contém ao menos 3 URLs apontando pra /assets/", async () => {
    const { stockShowroomPhotos } = await import("@/lib/sites/brand-assets");
    expect(stockShowroomPhotos.length).toBeGreaterThanOrEqual(3);
    for (const url of stockShowroomPhotos) {
      expect(url).toMatch(/^\/assets\//);
    }
  });
});

// ===========================================================================
// Cobertura adicional — caminhos defensivos (warn paths)
// ===========================================================================

describe("cobertura — branches defensivos", () => {
  it("tryInstagramAvatar — actor run sem defaultDatasetId → null", async () => {
    apifyState.igCall.mockResolvedValue({}); // no defaultDatasetId

    const { tryInstagramAvatar } = await import("@/lib/sites/brand-assets");
    expect(await tryInstagramAvatar("acme")).toBeNull();
  });

  it("tryInstagramAvatar — item sem profilePicUrl → null", async () => {
    apifyState.igCall.mockResolvedValue({ defaultDatasetId: "ds-x" });
    apifyState.igListItems.mockResolvedValue({
      items: [{ username: "acme" }], // sem profilePicUrl
    });

    const { tryInstagramAvatar } = await import("@/lib/sites/brand-assets");
    expect(await tryInstagramAvatar("acme")).toBeNull();
  });

  it("tryGoogleMapsProfilePhoto — actor run sem defaultDatasetId → null", async () => {
    apifyState.mapsCall.mockResolvedValue({});

    const { tryGoogleMapsProfilePhoto } = await import(
      "@/lib/sites/brand-assets"
    );
    expect(await tryGoogleMapsProfilePhoto("ChIJ-x")).toBeNull();
  });

  it("tryGoogleMapsProfilePhoto — items vazios → null", async () => {
    apifyState.mapsCall.mockResolvedValue({ defaultDatasetId: "ds-x" });
    apifyState.mapsListItems.mockResolvedValue({ items: [] });

    const { tryGoogleMapsProfilePhoto } = await import(
      "@/lib/sites/brand-assets"
    );
    expect(await tryGoogleMapsProfilePhoto("ChIJ-x")).toBeNull();
  });

  it("tryGoogleMapsProfilePhoto — Apify lança → null", async () => {
    apifyState.mapsCall.mockRejectedValue(new Error("apify down"));

    const { tryGoogleMapsProfilePhoto } = await import(
      "@/lib/sites/brand-assets"
    );
    expect(await tryGoogleMapsProfilePhoto("ChIJ-x")).toBeNull();
  });

  it("tryWebsiteFavicon — HTTP não-OK (404) → null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );

    const { tryWebsiteFavicon } = await import("@/lib/sites/brand-assets");
    expect(await tryWebsiteFavicon("https://acme.com.br")).toBeNull();
  });

  it("fetchMapsPhotos — actor run sem defaultDatasetId → []", async () => {
    apifyState.mapsCall.mockResolvedValue({});

    const { fetchMapsPhotos } = await import("@/lib/sites/brand-assets");
    expect(await fetchMapsPhotos("ChIJ-x", 3)).toEqual([]);
  });

  it("fetchMapsPhotos — count <= 0 → []", async () => {
    const { fetchMapsPhotos } = await import("@/lib/sites/brand-assets");
    expect(await fetchMapsPhotos("ChIJ-x", 0)).toEqual([]);
  });

  it("fetchMapsPhotos — Apify lança → []", async () => {
    apifyState.mapsCall.mockRejectedValue(new Error("apify oops"));

    const { fetchMapsPhotos } = await import("@/lib/sites/brand-assets");
    expect(await fetchMapsPhotos("ChIJ-x", 3)).toEqual([]);
  });

  it("buildMonogramLogo — 'X' (1 letra) → SVG com 'XX' duplicado", async () => {
    blobState.putMock.mockResolvedValue({
      url: "https://blob.test/monogram-x.svg",
    });
    const { buildMonogramLogo } = await import("@/lib/sites/brand-assets");
    await buildMonogramLogo("X", "#000000");
    const svg = String(blobState.putMock.mock.calls[0]![1]);
    expect(svg).toContain("XX");
  });

  it("buildMonogramLogo — só pontuação ('!!!') → fallback 'XX'", async () => {
    blobState.putMock.mockResolvedValue({
      url: "https://blob.test/monogram-fb.svg",
    });
    const { buildMonogramLogo } = await import("@/lib/sites/brand-assets");
    await buildMonogramLogo("!!!", "#000000");
    const svg = String(blobState.putMock.mock.calls[0]![1]);
    expect(svg).toContain("XX");
  });

  it("extractBrandAssets — pipeline cai em fallback catastrófico se runLogoCascade lança fora dos try/catch internos", async () => {
    // Forçamos uma falha não-capturada: pickCarStock recebe count maior que
    // STOCK_PHOTOS_TOTAL — disparado via mock do módulo de stock-photos.
    vi.doMock("@/lib/sites/stock-photos", () => ({
      pickCarStock: () => {
        throw new Error("boom — mock stock-photos");
      },
    }));
    blobState.putMock.mockResolvedValue({ url: "https://blob.test/m.svg" });
    apifyState.igCall.mockRejectedValue(new Error("no"));
    apifyState.mapsCall.mockRejectedValue(new Error("no"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    vibrantState.getPaletteMock.mockResolvedValue({});

    const { extractBrandAssets } = await import("@/lib/sites/brand-assets");
    const result = await extractBrandAssets(makeLead({ name: "Acme" }));

    // Cai no fallback catastrófico (logo data URI + cor preta).
    expect(result.logo_url.startsWith("data:image/svg+xml;base64,")).toBe(
      true,
    );
    expect(result.primary_color).toBe("#000000");
    expect(result.text_on_primary).toBe("#FFFFFF");
    expect(result.car_placeholder_urls).toHaveLength(6);

    vi.doUnmock("@/lib/sites/stock-photos");
  });

  it("extractBrandAssets — extrai placeId de raw.placeId (string)", async () => {
    apifyState.igCall.mockRejectedValue(new Error("no ig"));
    apifyState.mapsCall.mockResolvedValue({ defaultDatasetId: "ds" });
    apifyState.mapsListItems.mockResolvedValue({
      items: [
        { imageUrls: ["https://maps.googleusercontent.com/p/X.jpg"] },
      ],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    blobState.putMock.mockResolvedValue({ url: "https://blob.test/m.svg" });
    vibrantState.getPaletteMock.mockResolvedValue({});

    const { extractBrandAssets } = await import("@/lib/sites/brand-assets");
    const result = await extractBrandAssets(
      makeLead({ raw: { placeId: "ChIJ-from-raw" } as never }),
    );

    expect(result.logo_url).toBe(
      "https://maps.googleusercontent.com/p/X.jpg",
    );
  });

  it("extractBrandAssets — raw como array → placeId null (sem hit no Maps)", async () => {
    apifyState.igCall.mockRejectedValue(new Error("no ig"));
    apifyState.mapsCall.mockRejectedValue(new Error("not called"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    blobState.putMock.mockResolvedValue({ url: "https://blob.test/m.svg" });
    vibrantState.getPaletteMock.mockResolvedValue({});

    const { extractBrandAssets } = await import("@/lib/sites/brand-assets");
    const result = await extractBrandAssets(
      makeLead({ raw: [1, 2, 3] as never }),
    );

    expect(result.logo_url).toBe("https://blob.test/m.svg");
    expect(apifyState.mapsCall).not.toHaveBeenCalled();
  });

  it("extractBrandAssets — raw com place_id (snake_case) → usa snake_case fallback", async () => {
    apifyState.igCall.mockRejectedValue(new Error("no ig"));
    apifyState.mapsCall.mockResolvedValue({ defaultDatasetId: "ds" });
    apifyState.mapsListItems.mockResolvedValue({
      items: [{ imageUrls: ["https://maps.x/snake.jpg"] }],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    blobState.putMock.mockResolvedValue({ url: "https://blob.test/m.svg" });
    vibrantState.getPaletteMock.mockResolvedValue({});

    const { extractBrandAssets } = await import("@/lib/sites/brand-assets");
    const result = await extractBrandAssets(
      makeLead({ raw: { place_id: "ChIJ-snake" } as never }),
    );

    expect(result.logo_url).toBe("https://maps.x/snake.jpg");
  });

  it("extractBrandAssets — Vibrant ok com palette real + logo non-svg → usa pickAccent", async () => {
    apifyState.igCall.mockResolvedValue({ defaultDatasetId: "ds-ig" });
    apifyState.igListItems.mockResolvedValue({
      items: [{ profilePicUrl: "https://cdn.x/avatar.jpg" }],
    });
    apifyState.mapsCall.mockRejectedValue(new Error("no"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    blobState.putMock.mockResolvedValue({ url: "irrelevant" });
    vibrantState.getPaletteMock.mockResolvedValue({
      Vibrant: {
        getHex: () => "#ff8800",
        getPopulation: () => 100,
        getHsl: () => [0.1, 0.9, 0.5],
      },
    });

    const { extractBrandAssets } = await import("@/lib/sites/brand-assets");
    const result = await extractBrandAssets(
      makeLead({ instagram_handle: "acme" }),
    );

    expect(result.logo_url).toBe("https://cdn.x/avatar.jpg");
    expect(result.primary_color).toBe("#ff8800");
  });

  it("pickAccent — swatch com hex malformado → normalizeHex retorna fallback", async () => {
    const { pickAccent } = await import("@/lib/sites/brand-assets");
    const result = pickAccent({
      Vibrant: {
        getHex: () => "not-a-hex",
        getPopulation: () => 100,
        getHsl: () => [0, 1, 0.5],
      },
    } as never);
    expect(result).toBe("#000000");
  });

  it("pickAccent — Hsl sem saturation (undefined idx 1) → score 0, fallback se todos 0", async () => {
    const { pickAccent } = await import("@/lib/sites/brand-assets");
    // Mocka swatch com tuple onde [1] é undefined (edge case do narrowing).
    const swatch = {
      getHex: () => "#abcdef",
      getPopulation: () => 100,
      getHsl: () => [0, 0, 0.5] as [number, number, number],
    };
    // saturation 0 → score = 0 = bestScore inicial -Infinity → still picks
    expect(pickAccent({ Vibrant: swatch } as never)).toBe("#abcdef");
  });
});
