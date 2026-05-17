"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { prefersReducedMotion } from "@/lib/sites/motion";

/**
 * Cross-page motion orchestrator for `/sites/[slug]/*` routes (Phase 7 /
 * Frente 05 Premium Pass — issue #P12).
 *
 * Plays a single subtle "page lift" (280ms opacity + 8px translateY,
 * cubic-bezier ease-out) on:
 *   1. Initial mount (first page load).
 *   2. Pathname change (App Router navigation — no `router.events` in
 *      Next 16, so `usePathname` + `useEffect` is the canonical signal).
 *
 * **Design decisions:**
 *   - Operates on `<main data-orchestrated>` — a single wrapper element
 *     that contains all page content. This avoids interference with
 *     individual `[data-reveal]` scroll-triggered sections (those animate
 *     their own children via `<HomeMotion>` / WP7 GSAP ScrollTrigger).
 *   - `data-orchestrated` attribute is the selector contract; added to
 *     `<main>` in `app/sites/[slug]/layout.tsx`.
 *   - **`prefers-reduced-motion`**: component returns `null` immediately
 *     (no effect registration) — entirely inert.
 *   - Bundle hygiene: no GSAP/anime dependency. Pure CSS transitions via
 *     inline `style` mutations + forced reflow trick. ~0.5 KB gzipped.
 *   - Server/client boundary: `"use client"` on this file only; layout
 *     itself remains an async Server Component.
 *
 * **Non-interference with `[data-reveal]`:**
 *   The lift animates the `<main>` wrapper (opacity + Y of the whole
 *   container), while `[data-reveal]` targets individual child sections
 *   inside `<main>`. The transitions are complementary — the wrapper
 *   settles in ~280ms; GSAP ScrollTrigger fires when sections enter the
 *   viewport (start "top 80%"), which is always later.
 *
 * Mounted in `app/sites/[slug]/layout.tsx` (after the `<main>` element
 * so the DOM query finds the node on first mount).
 */
export function MotionOrchestrator(): null {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (prefersReducedMotion()) return;

    const main = document.querySelector<HTMLElement>("main[data-orchestrated]");
    if (!main) return;

    // Reset to pre-animation state immediately (no transition yet).
    main.style.opacity = "0";
    main.style.transform = "translateY(8px)";
    main.style.transition = "none";

    // Force reflow so the browser registers the reset before we apply
    // the transition. Without this the browser would skip the reset and
    // animate from the current state.
    void main.offsetWidth;

    // Apply transition and target values — browser will interpolate.
    main.style.transition =
      "opacity 280ms cubic-bezier(0.16, 1, 0.3, 1), transform 280ms cubic-bezier(0.16, 1, 0.3, 1)";
    main.style.opacity = "1";
    main.style.transform = "translateY(0)";

    // Cleanup: reset inline styles on unmount / next pathname change so
    // the next run starts from a clean slate and doesn't inherit stale
    // transition values.
    return () => {
      main.style.transition = "";
      main.style.opacity = "";
      main.style.transform = "";
    };
  }, [pathname]);

  return null;
}
