/**
 * Helpers compartilhados pelos specs Playwright em `tests/e2e/sites/`
 * (Phase 7 — issue #166).
 *
 * Comunicam com a rota test-only `POST/DELETE /api/e2e-seed/seed-lead-site`
 * (gateada por `NODE_ENV !== 'production'` + `TEST_SEED_TOKEN`).
 *
 * Convenção: cada spec usa um slug único por teste (sufixo `crypto.randomUUID()`)
 * para evitar colisão na unique global `lead_sites_slug_uniq`.
 */
import type { APIRequestContext } from "@playwright/test";

import {
  validSiteVariablesFixture,
  validSiteCopyFixture,
} from "@/tests/fixtures/site-variables";
import type { SiteVariables } from "@/types/lead-site";

export const TEST_SEED_TOKEN = process.env.TEST_SEED_TOKEN ?? "";

/**
 * `true` quando os specs podem rodar (env vars de seed presentes + auth
 * de Supabase real configurado). Use no topo de cada `test.describe`:
 *
 *   test.skip(!sitesE2EEnabled(), "TEST_SEED_TOKEN ausente — pulando");
 */
export function sitesE2EEnabled(): boolean {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return Boolean(
    process.env.TEST_SEED_TOKEN &&
      process.env.TEST_SEED_USER_ID &&
      supaUrl &&
      // Heurística: placeholder "http://localhost" usado em CI sem Supabase
      // real. Ambiente real aponta para `https://<project>.supabase.co`.
      supaUrl !== "http://localhost" &&
      !supaUrl.startsWith("http://localhost/"),
  );
}

/**
 * Retorna `SiteVariables` válido pra seed. Aceita overrides parciais.
 */
export function getValidVariables(
  overrides: Partial<SiteVariables> = {},
): SiteVariables {
  return { ...validSiteVariablesFixture, ...overrides };
}

/**
 * Retorna o `SiteCopy` válido — útil pra specs que querem montar
 * variations sem importar o fixture diretamente.
 */
export function getValidCopy() {
  return validSiteCopyFixture;
}

interface SeedSiteOptions {
  slug: string;
  status: "draft" | "published" | "sent" | "archived";
  variables?: SiteVariables;
}

/**
 * Cria um `lead` + `lead_sites` row via rota test-only. Falha o teste
 * se a rota retornar status inesperado.
 */
export async function seedSite(
  request: APIRequestContext,
  options: SeedSiteOptions,
): Promise<{ slug: string; leadId: string }> {
  const variables = options.variables ?? getValidVariables();
  const url = `/api/e2e-seed/seed-lead-site?token=${encodeURIComponent(TEST_SEED_TOKEN)}`;
  const res = await request.post(url, {
    data: {
      slug: options.slug,
      status: options.status,
      variables,
    },
    headers: { "content-type": "application/json" },
  });
  if (!res.ok()) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(
      `seedSite falhou: status=${res.status()} body=${body.slice(0, 300)}`,
    );
  }
  const body = (await res.json()) as { slug: string; leadId: string };
  return body;
}

/**
 * Remove a `lead_sites` row e o `lead` associado. No-op silencioso se
 * o slug não existir (evita falha em afterEach quando o seed errou).
 */
export async function cleanupSite(
  request: APIRequestContext,
  options: { slug: string },
): Promise<void> {
  const url =
    `/api/e2e-seed/seed-lead-site?token=${encodeURIComponent(TEST_SEED_TOKEN)}` +
    `&slug=${encodeURIComponent(options.slug)}`;
  const res = await request.delete(url);
  if (!res.ok()) {
    // Cleanup não deve fazer fail em afterEach — apenas warn.
    const body = await res.text().catch(() => "<no body>");
    console.warn(
      `[cleanupSite] status=${res.status()} slug=${options.slug} body=${body.slice(0, 200)}`,
    );
  }
}

/**
 * Gera slug único pra um spec (3-80 chars `[a-z0-9-]`).
 */
export function makeTestSlug(prefix: string): string {
  const id = crypto.randomUUID().split("-")[0]!.toLowerCase();
  return `${prefix}-${id}`.slice(0, 80);
}
