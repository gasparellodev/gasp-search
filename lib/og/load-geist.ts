import "server-only";

const GEIST_FONT_PATH = "/fonts/geist-600.woff2";
const GEIST_LOAD_TIMEOUT_MS = 1000;

let geistFontPromise: Promise<ArrayBuffer | null> | null = null;

export async function loadGeist(): Promise<ArrayBuffer | null> {
  geistFontPromise ??= readGeistFont();
  return geistFontPromise;
}

async function readGeistFont(): Promise<ArrayBuffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEIST_LOAD_TIMEOUT_MS);

  try {
    const res = await fetch(resolveGeistFontUrl(), { signal: controller.signal });
    if (!res.ok) {
      console.warn("og:font:fail", { status: res.status });
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn("og:font:fail", { reason: (err as Error).name });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function resolveGeistFontUrl(): URL {
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return new URL(GEIST_FONT_PATH, `https://${vercelUrl.replace(/^https?:\/\//i, "")}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  return new URL(GEIST_FONT_PATH, appUrl);
}
