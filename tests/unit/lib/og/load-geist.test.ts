import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;
const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalVercelUrl = process.env.VERCEL_URL;
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

async function importFreshModule() {
  vi.resetModules();
  return await import("@/lib/og/load-geist");
}

function makeBuffer(byte = 71): ArrayBuffer {
  return Uint8Array.from([byte]).buffer;
}

describe("loadGeist", () => {
  beforeEach(() => {
    warnSpy.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreEnv("NEXT_PUBLIC_APP_URL", originalNextPublicAppUrl);
    restoreEnv("VERCEL_URL", originalVercelUrl);
    vi.useRealTimers();
  });

  it("lê Geist 600 do bundle local em public/fonts", async () => {
    const buffer = makeBuffer();
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(buffer));
    globalThis.fetch = fetchMock as typeof fetch;

    const { loadGeist } = await importFreshModule();

    const loaded = await loadGeist();

    expect(new Uint8Array(loaded ?? new ArrayBuffer(0))).toEqual(
      new Uint8Array(buffer),
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    const [input, init] = fetchMock.mock.calls[0] as [
      RequestInfo | URL,
      RequestInit | undefined,
    ];
    expect(input).toBeInstanceOf(URL);
    expect((input as URL).pathname).toBe("/fonts/geist-600.woff2");
    expect((input as URL).href).not.toContain("github.com");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("memoiza leitura bem-sucedida para evitar I/O repetido", async () => {
    const buffer = makeBuffer(88);
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(buffer));
    globalThis.fetch = fetchMock as typeof fetch;

    const { loadGeist } = await importFreshModule();

    const first = await loadGeist();
    const second = await loadGeist();

    expect(new Uint8Array(first ?? new ArrayBuffer(0))).toEqual(
      new Uint8Array(buffer),
    );
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("prefere VERCEL_URL para ler a fonte do deployment preview", async () => {
    process.env.VERCEL_URL = "preview.example.vercel.app";
    process.env.NEXT_PUBLIC_APP_URL = "https://production.example.com";
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(makeBuffer()));
    globalThis.fetch = fetchMock as typeof fetch;

    const { loadGeist } = await importFreshModule();

    await expect(loadGeist()).resolves.toBeInstanceOf(ArrayBuffer);
    const [input] = fetchMock.mock.calls[0] as [RequestInfo | URL];
    expect((input as URL).href).toBe(
      "https://preview.example.vercel.app/fonts/geist-600.woff2",
    );
  });

  it("retorna null e registra status quando a leitura local falha", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 404 }),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const { loadGeist } = await importFreshModule();

    await expect(loadGeist()).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith("og:font:fail", { status: 404 });
  });

  it("aborta a leitura após 1 segundo e retorna null", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>(
      async (...[, init]) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const { loadGeist } = await importFreshModule();
    const promise = loadGeist();

    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith("og:font:fail", {
      reason: "AbortError",
    });
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
