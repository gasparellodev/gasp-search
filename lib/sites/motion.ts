/**
 * Motion helper foundation (Phase 7 / WP1 — issue #290).
 *
 * Lazily loads GSAP 3 + anime.js v4 on the client, registers ScrollTrigger
 * exactly once, and exposes a SSR-safe `prefers-reduced-motion` check.
 *
 * IMPORTANT — exception to the "server-only" default of `lib/sites/`:
 *
 *   This module is intentionally client-runnable. It does NOT import
 *   `'server-only'` and does NOT declare `'use client'` at the top — the
 *   `'use client'` directive belongs to the calling component
 *   (e.g. `<AnnouncementBar>`, `<HomeHero>`, scroll-reveal helpers).
 *
 *   Same exception applies to `static-map.ts` and `site-assets.ts`. See
 *   `lib/sites/CLAUDE.md` → "Server-only por padrão" for the full rule.
 *
 * Bundle hygiene:
 *   - `gsap` and `gsap/ScrollTrigger` are loaded via dynamic `import()` so
 *     Next.js/Turbopack emits them as separate chunks; they do NOT inflate
 *     the initial JS for `/sites/[slug]`.
 *   - `animejs` v4 ships as ESM with `sideEffects: false` and uses named
 *     exports (`import { animate, stagger } from 'animejs'`). The legacy
 *     default-export `anime(...)` API is NOT used.
 */

// ---------------------------------------------------------------------------
// Types — surface used by callers (WPs 2/3/7). Kept narrow to avoid leaking
// the GSAP global typings into RSC compilation.
// ---------------------------------------------------------------------------

type GsapModule = typeof import("gsap");
type ScrollTriggerModule = typeof import("gsap/ScrollTrigger");
type AnimeModule = typeof import("animejs");

export interface GsapBundle {
  gsap: GsapModule["gsap"];
  ScrollTrigger: ScrollTriggerModule["ScrollTrigger"];
}

// ---------------------------------------------------------------------------
// Module-level memoization for the dynamic imports. Module state is shared
// per JS realm — exactly what we want: GSAP plugin registration must happen
// once, and subsequent callers re-use the resolved Promise without
// triggering another `import()`.
// ---------------------------------------------------------------------------

let gsapPromise: Promise<GsapBundle> | null = null;
let animePromise: Promise<AnimeModule> | null = null;

// ---------------------------------------------------------------------------
// `prefers-reduced-motion` check — SSR-safe, deliberately NOT memoized so
// callers re-read the latest user preference on every invocation.
// ---------------------------------------------------------------------------

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---------------------------------------------------------------------------
// `loadGsap()` — dynamic import + one-time plugin registration.
// ---------------------------------------------------------------------------

export function loadGsap(): Promise<GsapBundle> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("loadGsap() must be called on the client"),
    );
  }

  if (gsapPromise) {
    return gsapPromise;
  }

  gsapPromise = (async () => {
    const [gsapMod, scrollTriggerMod] = await Promise.all([
      import("gsap"),
      import("gsap/ScrollTrigger"),
    ]);
    const { gsap } = gsapMod;
    const { ScrollTrigger } = scrollTriggerMod;
    gsap.registerPlugin(ScrollTrigger);
    return { gsap, ScrollTrigger };
  })();

  return gsapPromise;
}

// ---------------------------------------------------------------------------
// `loadAnime()` — dynamic import for anime.js v4 (named exports API).
// ---------------------------------------------------------------------------

export function loadAnime(): Promise<AnimeModule> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("loadAnime() must be called on the client"),
    );
  }

  if (animePromise) {
    return animePromise;
  }

  animePromise = import("animejs");
  return animePromise;
}
