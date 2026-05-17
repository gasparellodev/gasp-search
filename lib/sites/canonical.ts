/**
 * `lib/sites/canonical.ts` — Pure helper for canonical URL normalization.
 *
 * Issue #366 / Frente 03 SEO Infra.
 *
 * Returns the canonical form of a `/sites/*` pathname (lowercase, no trailing
 * slash), or `null` if pathname is already canonical or not under `/sites/`.
 *
 * Consumed by `proxy.ts` to emit 308 redirects, preserving SEO equity and
 * preventing duplicate-content penalties for variant URLs like `/Sites/X/`,
 * `/sites/X`, `/sites/x/`, etc.
 *
 * **Pure / Edge-runtime safe** — no `import "server-only"` so `proxy.ts` can
 * import it directly. Caller is responsible for preserving the original
 * query string when constructing the redirect URL.
 */
export function normalizeCanonical(pathname: string): string | null {
  if (!pathname.toLowerCase().startsWith("/sites/")) return null;
  let normalized = pathname.toLowerCase();
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized === pathname ? null : normalized;
}
