/**
 * Test-only route — `POST /api/e2e-seed/seed-lead-site` and
 * `DELETE /api/e2e-seed/seed-lead-site?slug=...`.
 *
 * Phase 7 — issue #166. Used **exclusively** by Playwright specs in
 * `tests/e2e/sites/` to seed/cleanup `lead_sites` rows without hitting
 * the real generation pipeline (Anthropic + Apify).
 *
 * **Triple safety gate:**
 *   1. `process.env.NODE_ENV === "production"` → 404 (route disappears).
 *   2. Missing `TEST_SEED_TOKEN` env → 503 (route disabled by config).
 *   3. `?token=` query param must equal `TEST_SEED_TOKEN` → else 401.
 *
 * The token is a shared secret only present in dev/test environments.
 * In CI, the workflow injects a fixed value; in local dev the developer
 * sets it in `.env.local`. **Never commit a real token.**
 *
 * **`TEST_SEED_USER_ID`** (UUID) is also required and must match a real
 * row in `auth.users` (the `leads.user_id` FK enforces this). Without
 * it, INSERT fails with foreign-key violation. The route returns 503
 * up-front when missing to give a clearer error than the Postgres one.
 *
 * **Service-role on purpose.** The route is gated for non-prod only and
 * the surface is intentionally narrow: insert one lead + one
 * `lead_sites` row, or delete by slug. No arbitrary SQL passes through.
 */
import "server-only";

import { NextResponse } from "next/server";

import { createServiceSupabase } from "@/lib/supabase/service";
import type { Database } from "@/types/database";

type LeadSiteStatus = Database["public"]["Enums"]["lead_site_status"];

interface SeedBody {
  slug: unknown;
  status: unknown;
  variables: unknown;
}

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function getToken(): string | undefined {
  return process.env.TEST_SEED_TOKEN;
}

function getTestUserId(): string | undefined {
  return process.env.TEST_SEED_USER_ID;
}

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function notAvailable() {
  return NextResponse.json(
    { error: "not_available_in_production" },
    { status: 404 },
  );
}

function disabled(reason: string) {
  return NextResponse.json(
    { error: "test_seed_disabled", reason },
    { status: 503 },
  );
}

function isValidStatus(value: unknown): value is LeadSiteStatus {
  return (
    typeof value === "string" &&
    (value === "draft" ||
      value === "published" ||
      value === "sent" ||
      value === "archived")
  );
}

function isValidSlug(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9-]{3,80}$/i.test(value);
}

export async function POST(request: Request) {
  if (isProd()) return notAvailable();

  const expected = getToken();
  if (!expected) return disabled("TEST_SEED_TOKEN ausente");

  const url = new URL(request.url);
  if (url.searchParams.get("token") !== expected) return unauthorized();

  const userId = getTestUserId();
  if (!userId) return disabled("TEST_SEED_USER_ID ausente");

  let body: SeedBody;
  try {
    body = (await request.json()) as SeedBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isValidSlug(body.slug)) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  }
  if (!isValidStatus(body.status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  if (!body.variables || typeof body.variables !== "object") {
    return NextResponse.json({ error: "invalid_variables" }, { status: 400 });
  }

  const slug = body.slug;
  const status = body.status;
  const variables = body.variables as Record<string, unknown>;

  const supa = createServiceSupabase();

  // Insert a synthetic lead and the matching lead_sites row. We always
  // create a fresh lead (cleanup deletes both via cascade on lead_sites).
  const { data: lead, error: leadError } = await supa
    .from("leads")
    .insert({
      user_id: userId,
      source: "google_maps",
      name: `[E2E] ${slug}`,
      stage: "new",
    })
    .select("id")
    .single();

  if (leadError || !lead) {
    return NextResponse.json(
      { error: "lead_insert_failed", detail: leadError?.message ?? null },
      { status: 500 },
    );
  }

  const { error: siteError } = await supa.from("lead_sites").insert({
    user_id: userId,
    lead_id: lead.id,
    slug,
    status,
    variables: variables as Database["public"]["Tables"]["lead_sites"]["Insert"]["variables"],
    generated_at:
      status === "published" || status === "sent"
        ? new Date().toISOString()
        : null,
    published_at: status === "published" ? new Date().toISOString() : null,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  });

  if (siteError) {
    // Clean orphan lead before reporting.
    await supa.from("leads").delete().eq("id", lead.id);
    return NextResponse.json(
      { error: "site_insert_failed", detail: siteError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, slug, leadId: lead.id });
}

export async function DELETE(request: Request) {
  if (isProd()) return notAvailable();

  const expected = getToken();
  if (!expected) return disabled("TEST_SEED_TOKEN ausente");

  const url = new URL(request.url);
  if (url.searchParams.get("token") !== expected) return unauthorized();

  const slug = url.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  }

  const supa = createServiceSupabase();

  // Resolve lead_id from the site row, then delete in lead_sites first
  // (FK is `on delete cascade` from leads → lead_sites, but we delete
  // the parent lead too so test data doesn't leak).
  const { data: row } = await supa
    .from("lead_sites")
    .select("lead_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ ok: true, slug, deleted: false });
  }

  await supa.from("lead_sites").delete().eq("slug", slug);
  await supa.from("leads").delete().eq("id", row.lead_id);

  return NextResponse.json({ ok: true, slug, deleted: true });
}
