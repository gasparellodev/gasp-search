/**
 * scripts/list-sites-needing-vi.ts
 *
 * Lista lead_sites que ainda não têm `visual_identity` persistido,
 * sinalizando candidatos a rodar o pipeline `regenerateVisualIdentity`.
 *
 * Read-only. Usa service-role pra bypassar RLS — não escreve nada.
 *
 * Uso:
 *   npx tsx scripts/list-sites-needing-vi.ts
 *
 * Requer `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` em `.env.local`.
 */

import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { isLikelyGoogleMapsPhoto } from "@/lib/sites/sanitize";

const PLACEHOLDER_HOST_RE = /placehold\.co/i;
const PLACEHOLDER_MODEL_RE = /^modelo\s+[a-z0-9]+$/i;
const PLACEHOLDER_BRAND_RE = /ducarmo/i;

interface CarLike {
  brand?: string | null;
  model?: string | null;
  thumbnail_url?: string | null;
}

interface VariablesLike {
  business_name?: string;
  logo_url?: string | null;
  brand_assets?: { logo_url?: string | null } | null;
  cars?: CarLike[] | null;
}

export interface SiteRowInput {
  slug: string;
  lead_id: string;
  user_id: string;
  status: string;
  variables: unknown;
}

export interface RowSummary {
  slug: string;
  lead_id: string;
  user_id: string;
  status: string;
  business_name: string;
  has_google_maps_logo: boolean;
  cars_count: number;
  has_placeholder_cars: boolean;
}

function asVariables(value: unknown): VariablesLike {
  if (value !== null && typeof value === "object") {
    return value as VariablesLike;
  }
  return {};
}

function logoUrlOf(vars: VariablesLike): string | null | undefined {
  return vars.brand_assets?.logo_url ?? vars.logo_url ?? null;
}

function isPlaceholderCar(car: CarLike): boolean {
  const thumb = car.thumbnail_url ?? "";
  if (PLACEHOLDER_HOST_RE.test(thumb)) return true;

  const model = (car.model ?? "").trim();
  if (PLACEHOLDER_MODEL_RE.test(model)) return true;

  const brand = car.brand ?? "";
  if (PLACEHOLDER_BRAND_RE.test(brand)) return true;

  return false;
}

export function projectSiteRow(row: SiteRowInput): RowSummary {
  const vars = asVariables(row.variables);
  const cars = Array.isArray(vars.cars) ? vars.cars : [];

  return {
    slug: row.slug,
    lead_id: row.lead_id,
    user_id: row.user_id,
    status: row.status,
    business_name: vars.business_name?.trim() || "(unknown)",
    has_google_maps_logo: isLikelyGoogleMapsPhoto(logoUrlOf(vars)),
    cars_count: cars.length,
    has_placeholder_cars: cars.some(isPlaceholderCar),
  };
}

async function main(): Promise<void> {
  config({ path: ".env.local" });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: rows, error } = await supabase
    .from("lead_sites")
    .select("slug, lead_id, user_id, status, variables")
    .is("visual_identity", null)
    .in("status", ["published", "sent"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log("No lead_sites with visual_identity=null and status in (published, sent).");
    return;
  }

  const summaries = rows.map((row) =>
    projectSiteRow({
      slug: row.slug,
      lead_id: row.lead_id,
      user_id: row.user_id,
      status: row.status,
      variables: row.variables,
    }),
  );

  console.log(`Found ${summaries.length} site(s) needing visual_identity:\n`);
  console.table(summaries);
}

const isDirectInvocation =
  process.argv[1] !== undefined &&
  process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  main().catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
  });
}
