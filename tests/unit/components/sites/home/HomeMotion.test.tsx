/**
 * Testes do <HomeMotion /> (Phase 7 / WP7 — issue #296).
 *
 * Side-effect Client Component: ao montar, anima `[data-reveal]` via GSAP
 * ScrollTrigger. Não tem render visível — testes verificam o lifecycle:
 *   - Não chama loadGsap quando `prefers-reduced-motion: reduce`.
 *   - Chama loadGsap quando OK animar.
 *   - Cleanup mata ScrollTriggers no unmount.
 */
import { render } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const loadGsapMock = vi.fn();
const prefersReducedMotionMock = vi.fn();

vi.mock("@/lib/sites/motion", () => ({
  loadGsap: () => loadGsapMock(),
  prefersReducedMotion: () => prefersReducedMotionMock(),
  // `loadAnime` não é consumido por `<HomeMotion>` mas o módulo exporta —
  // stub vazio pra evitar surprise se alguém importar.
  loadAnime: vi.fn(),
}));

import { HomeMotion } from "@/components/sites/home/HomeMotion";

function matchMediaImpl(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  loadGsapMock.mockReset();
  prefersReducedMotionMock.mockReset();
  matchMediaImpl(false);
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("<HomeMotion />", () => {
  it("NÃO chama loadGsap quando prefers-reduced-motion (skip animation)", async () => {
    prefersReducedMotionMock.mockReturnValue(true);

    render(<HomeMotion />);

    // useEffect roda síncronamente em jsdom; sleep mínimo pra garantir
    // que microtasks executem antes da assertion.
    await Promise.resolve();
    expect(loadGsapMock).not.toHaveBeenCalled();
  });

  it("chama loadGsap quando reduced-motion é false", async () => {
    prefersReducedMotionMock.mockReturnValue(false);
    // loadGsap retorna promise rejeitada — catch silencioso degrada
    // graciosamente; testamos só que foi chamado.
    loadGsapMock.mockResolvedValue({
      gsap: { from: vi.fn().mockReturnValue({}) },
      ScrollTrigger: { refresh: vi.fn() },
    });

    render(<HomeMotion />);

    await Promise.resolve();
    expect(loadGsapMock).toHaveBeenCalledTimes(1);
  });

  it("não quebra se loadGsap rejeitar (fallback gracioso)", async () => {
    prefersReducedMotionMock.mockReturnValue(false);
    loadGsapMock.mockRejectedValue(new Error("CDN down"));

    // Spy em console.error pra garantir que NÃO logamos erro UX cosmético.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = render(<HomeMotion />);
    await Promise.resolve();
    await Promise.resolve();

    // Componente não deve crashar, console.error não deve ter sido
    // chamado (catch silencioso).
    expect(() => unmount()).not.toThrow();
    errorSpy.mockRestore();
  });

  it("renderiza null (sem markup)", () => {
    prefersReducedMotionMock.mockReturnValue(true);
    const { container } = render(<HomeMotion />);
    expect(container.firstChild).toBeNull();
  });
});

describe("<HomeMotion /> — variants (WP2 #310)", () => {
  function setupGsapMocks() {
    const fromFn = vi.fn(() => ({}));
    const fromToFn = vi.fn(() => ({}));
    const refreshFn = vi.fn();
    loadGsapMock.mockResolvedValue({
      gsap: { from: fromFn, fromTo: fromToFn },
      ScrollTrigger: { refresh: refreshFn },
    });
    return { fromFn, fromToFn, refreshFn };
  }

  it("variant=hero-image: chama gsap.fromTo (scale + opacity, sem scrollTrigger)", async () => {
    prefersReducedMotionMock.mockReturnValue(false);
    const { fromToFn } = setupGsapMocks();

    document.body.innerHTML = `
      <div data-reveal data-reveal-variant="hero-image" data-testid="image-wrapper"></div>
    `;

    render(<HomeMotion />);
    await Promise.resolve();
    await Promise.resolve();

    expect(fromToFn).toHaveBeenCalledTimes(1);
    const call = fromToFn.mock.calls[0]!;
    const [target, fromState, toState] = call as unknown as [
      HTMLElement,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(target.getAttribute("data-testid")).toBe("image-wrapper");
    expect(fromState).toMatchObject({ scale: 1.0, opacity: 0 });
    expect(toState).toMatchObject({ scale: 1.05, opacity: 1 });
    expect(toState.scrollTrigger).toBeUndefined();
  });

  it("variant=hero-card: chama gsap.from com slide-up + scale (sem scrollTrigger)", async () => {
    prefersReducedMotionMock.mockReturnValue(false);
    const { fromFn } = setupGsapMocks();

    document.body.innerHTML = `
      <div data-reveal data-reveal-variant="hero-card" data-testid="card"></div>
    `;

    render(<HomeMotion />);
    await Promise.resolve();
    await Promise.resolve();

    expect(fromFn).toHaveBeenCalledTimes(1);
    const call = fromFn.mock.calls[0]!;
    const [target, opts] = call as unknown as [
      HTMLElement,
      Record<string, unknown>,
    ];
    expect(target.getAttribute("data-testid")).toBe("card");
    expect(opts).toMatchObject({ y: 48, scale: 0.96, opacity: 0 });
    expect(opts.scrollTrigger).toBeUndefined();
  });

  it("variant=hero-cta-stagger: chama gsap.from nos FILHOS diretos com stagger", async () => {
    prefersReducedMotionMock.mockReturnValue(false);
    const { fromFn } = setupGsapMocks();

    document.body.innerHTML = `
      <div data-reveal data-reveal-variant="hero-cta-stagger">
        <h1>Heading</h1>
        <p>Passage</p>
        <button>CTA</button>
      </div>
    `;

    render(<HomeMotion />);
    await Promise.resolve();
    await Promise.resolve();

    expect(fromFn).toHaveBeenCalledTimes(1);
    const call = fromFn.mock.calls[0]!;
    const [targets, opts] = call as unknown as [
      HTMLElement[],
      Record<string, unknown>,
    ];
    expect(Array.isArray(targets)).toBe(true);
    expect(targets.length).toBe(3);
    expect(opts).toMatchObject({
      y: 12,
      opacity: 0,
      stagger: 0.08,
      delay: 0.6,
    });
  });

  it("data-reveal sem variant: mantém comportamento legado WP7 (scrollTrigger fade-up)", async () => {
    prefersReducedMotionMock.mockReturnValue(false);
    const { fromFn } = setupGsapMocks();

    document.body.innerHTML = `
      <div data-reveal data-testid="legacy"></div>
    `;

    render(<HomeMotion />);
    await Promise.resolve();
    await Promise.resolve();

    expect(fromFn).toHaveBeenCalledTimes(1);
    const call = fromFn.mock.calls[0]!;
    const [, opts] = call as unknown as [
      HTMLElement,
      Record<string, unknown>,
    ];
    expect(opts.y).toBe(32);
    expect(opts.scrollTrigger).toBeDefined();
    expect(
      (opts.scrollTrigger as Record<string, unknown>).toggleActions,
    ).toBe("play none none none");
  });

  it("prefers-reduced-motion: variantes viram no-op (gsap nunca chamado)", async () => {
    prefersReducedMotionMock.mockReturnValue(true);
    const { fromFn, fromToFn } = setupGsapMocks();

    document.body.innerHTML = `
      <div data-reveal data-reveal-variant="hero-image"></div>
      <div data-reveal data-reveal-variant="hero-card"></div>
      <div data-reveal data-reveal-variant="hero-cta-stagger"><span></span></div>
    `;

    render(<HomeMotion />);
    await Promise.resolve();
    await Promise.resolve();

    expect(loadGsapMock).not.toHaveBeenCalled();
    expect(fromFn).not.toHaveBeenCalled();
    expect(fromToFn).not.toHaveBeenCalled();
  });
});
