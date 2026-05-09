/**
 * One-shot seed: ajusta `lead_sites.variables` da Poliguara para validar
 * o redesign premium do Hero (#162 follow-up). Pode ser re-executado sem
 * efeito colateral.
 *
 * Uso:
 *   npx tsx scripts/seed-poliguara.ts
 *
 * Requer: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no `.env.local`.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function main() {
  // Find Poliguara — slug starts with `<nanoid>-poliguara-...`
  const { data: rows, error: findErr } = await supabase
    .from("lead_sites")
    .select("id, slug, variables")
    .ilike("slug", "%poliguara%")
    .limit(5);
  if (findErr) throw findErr;
  if (!rows || rows.length === 0) {
    console.error("No site found with 'poliguara' in slug");
    process.exit(1);
  }
  console.log(
    `Found ${rows.length} candidate(s):`,
    rows.map((r) => r.slug),
  );

  for (const row of rows) {
    const current = (row.variables ?? {}) as Record<string, unknown>;
    const next = {
      ...current,
      logo_url: "/assets/logos/poliguara.png",
      primary_color: "#E30613", // brand red
      text_on_primary: "#FFFFFF",
      hero_image_url: "/assets/hero/porsche-model1.png", // Porsche Figma-fiel (default global)
      slogan: "Confiança, Tradição, Transparência.", // copy persuasiva escolhida (opção A)
    };
    const { error: updErr } = await supabase
      .from("lead_sites")
      .update({ variables: next })
      .eq("id", row.id);
    if (updErr) throw updErr;
    console.log(`Updated ${row.slug}: logo + red brand + hero->demo cutout`);
  }
}

main()
  .then(() => {
    console.log("Seed OK");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed FAILED:", err);
    process.exit(1);
  });
