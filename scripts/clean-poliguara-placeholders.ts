/**
 * Substitui todos os `placehold.co/.../0c0c0c/...` (placeholders pretos
 * do brand-pipeline default) por `/assets/placeholders/car.png` (cinza
 * claro local) no `lead_sites.variables` da Poliguara.
 *
 * Razão: usuário pediu site uniformemente branco/preto/vermelho. O
 * placehold.co default tem `0c0c0c` (preto) que sobressai como bloco
 * preto enorme nas thumbnails dos cards de carro/categoria/etc.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const PLACEHOLDER = "/assets/placeholders/car.png";
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

function isPlaceholdCo(u: unknown): boolean {
  return typeof u === "string" && /placehold\.co/i.test(u);
}

function replaceUrls<T>(obj: T): T {
  if (typeof obj === "string") {
    return (isPlaceholdCo(obj) ? PLACEHOLDER : obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(replaceUrls) as T;
  }
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = replaceUrls(v);
    }
    return out as T;
  }
  return obj;
}

async function main() {
  const { data, error } = await sb
    .from("lead_sites")
    .select("id, slug, variables")
    .ilike("slug", "%poliguara%")
    .single();
  if (error) throw error;

  const before = JSON.stringify(data.variables);
  const cleaned = replaceUrls(data.variables);
  const after = JSON.stringify(cleaned);

  const beforeCount = (before.match(/placehold\.co/g) ?? []).length;
  const afterCount = (after.match(/placehold\.co/g) ?? []).length;
  console.log(`placehold.co references: before=${beforeCount}, after=${afterCount}`);

  if (beforeCount === 0) {
    console.log("Nothing to clean.");
    return;
  }

  const { error: updErr } = await sb
    .from("lead_sites")
    .update({ variables: cleaned })
    .eq("id", data.id);
  if (updErr) throw updErr;
  console.log(`Cleaned ${beforeCount} placehold.co references on ${data.slug}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
