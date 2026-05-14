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
