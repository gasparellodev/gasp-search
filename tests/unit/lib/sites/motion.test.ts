/**
 * Tests for `lib/sites/motion.ts` (Phase 7 / WP1 — issue #290).
 *
 * Coverage requirements (per AC):
 *   - prefersReducedMotion(): SSR fallback + matchMedia true/false
 *   - loadGsap(): SSR rejection, returns { gsap, ScrollTrigger }, registers
 *     plugin exactly once across N calls, memoizes Promise (p1 === p2)
 *   - loadAnime(): SSR rejection, returns module, memoizes Promise
 *
 * Memoization is module-level, so each test that needs a fresh module
 * uses `vi.resetModules()` + dynamic `import()` to start clean.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// -----------------------------------------------------------------------------
// Module-level mocks for the dynamic imports.
// -----------------------------------------------------------------------------

const registerPluginMock = vi.fn();

vi.mock("gsap", () => ({
  gsap: {
    registerPlugin: registerPluginMock,
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: { __id: "ScrollTrigger" },
}));

vi.mock("animejs", () => ({
  animate: vi.fn(),
  stagger: vi.fn(),
}));

// -----------------------------------------------------------------------------
// Helpers for SSR simulation.
// -----------------------------------------------------------------------------

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "window",
);

function deleteWindow(): void {
  // jsdom installs `window` as a getter on globalThis. We replace the
  // property so `typeof window === 'undefined'` evaluates to true.
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: undefined,
  });
}

function restoreWindow(): void {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
  }
}

beforeEach(() => {
  vi.resetModules();
  registerPluginMock.mockClear();
});

afterEach(() => {
  restoreWindow();
});

// -----------------------------------------------------------------------------
// prefersReducedMotion()
// -----------------------------------------------------------------------------

describe("prefersReducedMotion", () => {
  it("retorna false em SSR (window === undefined)", async () => {
    deleteWindow();
    const { prefersReducedMotion } = await import("@/lib/sites/motion");
    expect(prefersReducedMotion()).toBe(false);
  });

  it("retorna true quando matchMedia('(prefers-reduced-motion: reduce)').matches === true", async () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true });
    // jsdom doesn't ship `matchMedia` by default — define it directly.
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: matchMediaMock,
    });

    const { prefersReducedMotion } = await import("@/lib/sites/motion");
    expect(prefersReducedMotion()).toBe(true);
    expect(matchMediaMock).toHaveBeenCalledWith(
      "(prefers-reduced-motion: reduce)",
    );
  });

  it("retorna false quando matchMedia retorna matches: false", async () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: false });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: matchMediaMock,
    });

    const { prefersReducedMotion } = await import("@/lib/sites/motion");
    expect(prefersReducedMotion()).toBe(false);
  });

  it("não memoiza — duas chamadas re-leem matchMedia (usuário pode mudar preferência em runtime)", async () => {
    const matchMediaMock = vi
      .fn()
      .mockReturnValueOnce({ matches: false })
      .mockReturnValueOnce({ matches: true });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: matchMediaMock,
    });

    const { prefersReducedMotion } = await import("@/lib/sites/motion");
    expect(prefersReducedMotion()).toBe(false);
    expect(prefersReducedMotion()).toBe(true);
    expect(matchMediaMock).toHaveBeenCalledTimes(2);
  });
});

// -----------------------------------------------------------------------------
// loadGsap()
// -----------------------------------------------------------------------------

describe("loadGsap", () => {
  it("rejeita com mensagem clara quando chamado em SSR", async () => {
    deleteWindow();
    const { loadGsap } = await import("@/lib/sites/motion");
    await expect(loadGsap()).rejects.toThrow(
      "loadGsap() must be called on the client",
    );
  });

  it("retorna { gsap, ScrollTrigger } com shape correto", async () => {
    const { loadGsap } = await import("@/lib/sites/motion");
    const result = await loadGsap();
    expect(result.gsap).toBeDefined();
    expect(typeof result.gsap.registerPlugin).toBe("function");
    expect(result.ScrollTrigger).toBeDefined();
  });

  it("chama gsap.registerPlugin(ScrollTrigger) exatamente 1 vez após 2 chamadas", async () => {
    const { loadGsap } = await import("@/lib/sites/motion");
    await loadGsap();
    await loadGsap();
    expect(registerPluginMock).toHaveBeenCalledTimes(1);
  });

  it("memoiza a Promise — 2 chamadas retornam a mesma referência", async () => {
    const { loadGsap } = await import("@/lib/sites/motion");
    const p1 = loadGsap();
    const p2 = loadGsap();
    expect(p1).toBe(p2);
    await Promise.all([p1, p2]);
  });
});

// -----------------------------------------------------------------------------
// loadAnime()
// -----------------------------------------------------------------------------

describe("loadAnime", () => {
  it("rejeita com mensagem clara quando chamado em SSR", async () => {
    deleteWindow();
    const { loadAnime } = await import("@/lib/sites/motion");
    await expect(loadAnime()).rejects.toThrow(
      "loadAnime() must be called on the client",
    );
  });

  it("retorna o módulo animejs mockado (named exports v4)", async () => {
    const { loadAnime } = await import("@/lib/sites/motion");
    const mod = await loadAnime();
    expect(mod).toBeDefined();
    expect(typeof mod.animate).toBe("function");
    expect(typeof mod.stagger).toBe("function");
  });

  it("memoiza a Promise — 2 chamadas retornam a mesma referência", async () => {
    const { loadAnime } = await import("@/lib/sites/motion");
    const p1 = loadAnime();
    const p2 = loadAnime();
    expect(p1).toBe(p2);
    await Promise.all([p1, p2]);
  });
});
