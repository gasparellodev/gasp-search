/**
 * Testes do <MotionOrchestrator /> (Phase 7 / Frente 05 Premium Pass — issue #P12).
 *
 * Cross-page orchestrator: side-effect only, renders null. Plays a subtle
 * "page lift" (280ms opacity + translateY) on mount and pathname change.
 *
 * Test strategy (jsdom limitations):
 *   - jsdom does NOT run CSS transitions, so we assert the final inline
 *     style values that the effect writes (opacity "1", transform
 *     "translateY(0)").
 *   - We assert the transition string is set before final values.
 *   - We mock `prefersReducedMotion` to test the no-op path.
 *   - We verify null render (no DOM elements emitted).
 *   - We verify graceful no-op when `<main data-orchestrated>` is absent.
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

// Mock must be declared before importing the component (vi.mock is hoisted).
const prefersReducedMotionMock = vi.fn();

vi.mock("@/lib/sites/motion", () => ({
  prefersReducedMotion: () => prefersReducedMotionMock(),
  // stub other exports to avoid surprise if the module is ever augmented
  loadGsap: vi.fn(),
  loadAnime: vi.fn(),
}));

// Mock next/navigation usePathname (used by the orchestrator)
vi.mock("next/navigation", () => ({
  usePathname: () => "/sites/test-slug",
}));

import { MotionOrchestrator } from "@/components/sites/motion/MotionOrchestrator";

function addOrchestratedMain(): HTMLElement {
  const main = document.createElement("main");
  main.setAttribute("data-orchestrated", "");
  document.body.appendChild(main);
  return main;
}

beforeEach(() => {
  prefersReducedMotionMock.mockReset();
  // Default: no reduced motion
  prefersReducedMotionMock.mockReturnValue(false);
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("<MotionOrchestrator />", () => {
  it("renderiza null (sem markup no DOM)", () => {
    addOrchestratedMain();
    const { container } = render(<MotionOrchestrator />);
    expect(container.firstChild).toBeNull();
  });

  it("não quebra quando não há <main data-orchestrated> no DOM", () => {
    // No main element in body — orchestrator must not throw
    prefersReducedMotionMock.mockReturnValue(false);
    expect(() => render(<MotionOrchestrator />)).not.toThrow();
  });

  it("não aplica estilos quando prefers-reduced-motion é true", async () => {
    prefersReducedMotionMock.mockReturnValue(true);
    const main = addOrchestratedMain();

    render(<MotionOrchestrator />);
    await Promise.resolve();

    // Styles must remain untouched when reduced motion is active
    expect(main.style.opacity).toBe("");
    expect(main.style.transform).toBe("");
    expect(main.style.transition).toBe("");
  });

  it("define opacity='1' e transform='translateY(0)' no <main> após o efeito", async () => {
    prefersReducedMotionMock.mockReturnValue(false);
    const main = addOrchestratedMain();

    render(<MotionOrchestrator />);

    // Wait for the useEffect microtask to flush
    await Promise.resolve();

    expect(main.style.opacity).toBe("1");
    expect(main.style.transform).toBe("translateY(0)");
  });

  it("define transition com 'opacity 280ms' no <main>", async () => {
    prefersReducedMotionMock.mockReturnValue(false);
    const main = addOrchestratedMain();

    render(<MotionOrchestrator />);
    await Promise.resolve();

    expect(main.style.transition).toContain("opacity 280ms");
  });

  it("limpa inline styles no unmount (cleanup do effect)", async () => {
    prefersReducedMotionMock.mockReturnValue(false);
    const main = addOrchestratedMain();

    const { unmount } = render(<MotionOrchestrator />);
    await Promise.resolve();

    // Verify styles were applied first
    expect(main.style.opacity).toBe("1");

    // Unmount triggers cleanup
    unmount();

    expect(main.style.opacity).toBe("");
    expect(main.style.transform).toBe("");
    expect(main.style.transition).toBe("");
  });
});
