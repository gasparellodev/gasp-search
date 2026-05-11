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

// Defaults para envs server-side validadas em `lib/env.ts`. Necessário
// porque qualquer test que importe `app/actions/lead-site.ts` (e tudo que
// puxa `lib/ai/anthropic.ts` ou `lib/supabase/service.ts`) executa o
// validador no boot. Tests que precisam de valores específicos (ex.
// `tests/unit/lib/env.test.ts`) sobrescrevem em `beforeEach`. Valores
// fake — nenhum SDK real é chamado em CI.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
}
if (!process.env.APIFY_TOKEN) {
  process.env.APIFY_TOKEN = "t";
}
if (!process.env.APIFY_GOOGLE_MAPS_ACTOR_ID) {
  process.env.APIFY_GOOGLE_MAPS_ACTOR_ID = "compass~crawler-google-places";
}
if (!process.env.APIFY_INSTAGRAM_ACTOR_ID) {
  process.env.APIFY_INSTAGRAM_ACTOR_ID = "apify~instagram-scraper";
}
if (!process.env.APIFY_WEBSITE_CONTACT_ACTOR_ID) {
  process.env.APIFY_WEBSITE_CONTACT_ACTOR_ID = "vdrmota~contact-info-scraper";
}
if (!process.env.ANTHROPIC_API_KEY) {
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
}
if (!process.env.ANTHROPIC_MODEL) {
  process.env.ANTHROPIC_MODEL = "claude-sonnet-4-6";
}
// OpenAI defaults (Phase 7 #216 — visual identity).
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "sk-openai-test";
}
if (!process.env.OPENAI_IMAGE_MODEL) {
  process.env.OPENAI_IMAGE_MODEL = "gpt-image-2-2026-04-21";
}
if (!process.env.OPENAI_IMAGE_FALLBACK_MODEL) {
  process.env.OPENAI_IMAGE_FALLBACK_MODEL = "gpt-image-1-mini";
}
if (!process.env.OPENAI_IMAGE_CONCURRENCY) {
  process.env.OPENAI_IMAGE_CONCURRENCY = "2";
}
if (!process.env.BRL_RATE) {
  process.env.BRL_RATE = "5.0";
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
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function setPointerCapture() {};
  }
}

afterEach(() => {
  cleanup();
});
