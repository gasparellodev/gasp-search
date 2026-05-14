/**
 * scripts/inspect-site-inventory.ts
 *
 * Inspeção read-only de `variables.cars[]` de um lead_site específico.
 * Útil pra decidir entre zerar/substituir/preservar a inventory antes
 * de rodar `regenerateVisualIdentity`.
 *
 * Uso:
 *   npx tsx scripts/inspect-site-inventory.ts <slug>
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { projectSiteRow } from "@/scripts/list-sites-needing-vi";

function truncate(value: string | null | undefined, max: number): string {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

async function main(): Promise<void> {
  config({ path: ".env.local" });

  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: npx tsx scripts/inspect-site-inventory.ts <slug>");
    process.exit(1);
  }

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

  const { data: row, error } = await supabase
    .from("lead_sites")
    .select("slug, lead_id, user_id, status, variables, visual_identity")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }
  if (!row) {
    console.error(`No lead_site found for slug=${slug}`);
    process.exit(1);
  }

  const summary = projectSiteRow({
    slug: row.slug,
    lead_id: row.lead_id,
    user_id: row.user_id,
    status: row.status,
    variables: row.variables,
  });

  const vars = (row.variables ?? {}) as {
    business_name?: string;
    cars?: Array<{
      id?: string;
      brand?: string;
      model?: string;
      year?: number;
      km?: number;
      price?: number | null;
      thumbnail_url?: string | null;
      gallery_urls?: string[] | null;
      photos?: string[] | null;
      category?: string;
    }>;
    brand_assets?: { logo_url?: string | null };
    logo_url?: string | null;
    address?: unknown;
  };

  const logoUrl = vars.brand_assets?.logo_url ?? vars.logo_url ?? null;

  console.log("\n=== Site overview ===");
  console.table([
    {
      slug: row.slug,
      lead_id: row.lead_id,
      user_id: row.user_id,
      status: row.status,
      business_name: summary.business_name,
      has_visual_identity: row.visual_identity !== null,
      is_google_maps_logo: summary.has_google_maps_logo,
      logo_url: truncate(logoUrl, 80),
      cars_count: summary.cars_count,
      placeholder_flag: summary.has_placeholder_cars,
    },
  ]);

  console.log("\n=== variables.address ===");
  console.log(JSON.stringify(vars.address ?? null, null, 2));

  console.log(`\n=== variables.cars[] (${summary.cars_count} entries) ===`);
  const cars = Array.isArray(vars.cars) ? vars.cars : [];
  console.table(
    cars.map((car, i) => ({
      i,
      id: truncate(car.id ?? "", 20),
      brand: car.brand ?? "",
      model: car.model ?? "",
      year: car.year ?? "",
      km: car.km ?? "",
      price: car.price ?? null,
      category: car.category ?? "",
      thumb: truncate(car.thumbnail_url ?? "", 60),
      photos: Array.isArray(car.photos)
        ? car.photos.length
        : Array.isArray(car.gallery_urls)
          ? car.gallery_urls.length
          : 0,
    })),
  );
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
