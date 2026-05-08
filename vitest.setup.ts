import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Defaults para envs públicas — permite que componentes que importam
// `@/lib/env-public` funcionem sem que cada test stub manualmente.
// Tests dedicados ao validador (`tests/unit/lib/env.test.ts`) reescrevem
// `process.env` por test e continuam funcionando.
if (!process.env.NEXT_PUBLIC_APP_URL) {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
}
if (!process.env.NEXT_PUBLIC_WHATSAPP_ENABLED) {
  process.env.NEXT_PUBLIC_WHATSAPP_ENABLED = "0";
}

// Polyfills mínimos para libs que assumem APIs do browser (cmdk, radix popover).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (typeof Element !== "undefined") {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoView() {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = function hasPointerCapture() {
      return false;
    };
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture =
      function releasePointerCapture() {};
  }
}

afterEach(() => {
  cleanup();
});
