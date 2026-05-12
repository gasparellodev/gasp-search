import "server-only";

import { env } from "@/lib/env";

const ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
  "https://yandex.com/indexnow",
  "https://searchadvisor.naver.com/indexnow",
] as const;

const BATCH_SIZE = 10;

function normalizeUrls(urls: readonly string[]): URL[] {
  const seen = new Set<string>();
  const out: URL[] = [];

  for (const raw of urls) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      const key = url.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(url);
    } catch {
      // Invalid input is ignored. Caller owns business logic; this helper
      // should only notify valid public URLs.
    }
  }

  return out;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function groupByHost(urls: readonly URL[]): Map<string, URL[]> {
  const groups = new Map<string, URL[]>();
  for (const url of urls) {
    const existing = groups.get(url.host);
    if (existing) {
      existing.push(url);
    } else {
      groups.set(url.host, [url]);
    }
  }
  return groups;
}

export async function notifyIndexNow(urls: readonly string[]): Promise<void> {
  const key = env.INDEXNOW_KEY;
  if (!key) {
    console.warn("indexnow:missing_key");
    return;
  }

  const normalized = normalizeUrls(urls);
  if (normalized.length === 0) return;

  for (const [host, hostUrls] of groupByHost(normalized)) {
    const origin = `${hostUrls[0]?.protocol ?? "https:"}//${host}`;
    for (const batch of chunk(hostUrls, BATCH_SIZE)) {
      const body = JSON.stringify({
        host,
        key,
        keyLocation: `${origin}/${key}.txt`,
        urlList: batch.map((url) => url.toString()),
      });

      await Promise.all(
        ENDPOINTS.map(async (endpoint) => {
          try {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body,
            });
            if (!response.ok) {
              console.warn("indexnow:notify_failed", {
                endpoint,
                status: response.status,
              });
            }
          } catch (err) {
            console.warn("indexnow:notify_failed", {
              endpoint,
              errorName: err instanceof Error ? err.name : "unknown",
              errorMessage: err instanceof Error ? err.message : String(err),
            });
          }
        }),
      );
    }
  }
}
