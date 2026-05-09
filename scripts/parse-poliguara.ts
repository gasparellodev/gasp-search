import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { SiteVariables } from "../types/lead-site";

config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  const { data, error } = await sb
    .from("lead_sites")
    .select("variables")
    .ilike("slug", "%poliguara%")
    .single();
  if (error) throw error;

  const result = SiteVariables.safeParse(data.variables);
  if (result.success) {
    console.log("PARSE OK");
    console.log("hero_image_url:", result.data.hero_image_url);
    console.log("logo_url:", result.data.logo_url);
    console.log("primary_color:", result.data.primary_color);
  } else {
    console.log("PARSE FAILED:");
    console.log(JSON.stringify(result.error.issues.slice(0, 10), null, 2));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
