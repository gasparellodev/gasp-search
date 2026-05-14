/**
 * scripts/run-visual-identity.ts
 *
 * CLI runner do pipeline `regenerateVisualIdentity` (action `app/actions/lead-site.ts`).
 *
 * Difere da server action porque:
 *   - Não exige sessão do user (lê `lead_sites.user_id` da row e usa
 *     service-role); útil pra rodar admin/manual quando o botão na UI
 *     não está acessível.
 *   - Imprime estimativa de custo USD/BRL e pergunta y/N **antes** de
 *     bater na OpenAI. Hard guard $2 USD igual à action.
 *   - Não invalida o cache do Next runtime (a action faz isso via
 *     `updateTag`). O script imprime o `curl` necessário pro
 *     `/api/dev/revalidate-site` no final.
 *
 * Uso:
 *   npm run vi:run -- <slug> [--force]
 *
 * (Ou direto: `NODE_OPTIONS='--conditions=react-server' npx tsx scripts/run-visual-identity.ts <slug>`.
 * A flag `--conditions=react-server` é necessária porque transitivamente o
 * script importa `@/lib/env`, que importa `server-only` — sem a condition,
 * o pacote `server-only` lança no boot. O npm script já injeta a flag.)
 */

import "@/scripts/_bootstrap-env";

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pLimit from "p-limit";

import { env } from "@/lib/env";
import { generateImage } from "@/lib/openai/image-client";
import {
  buildAssetSpecsForCars,
  buildIdentityContext,
  buildPrompt,
  deleteExistingAssets,
  estimateTotalCost,
  uploadAssetToStorage,
  type AssetSpec,
  type AssetVariant,
  type CostEstimate,
} from "@/lib/sites/visual-identity";
import type { Database } from "@/types/database";
import {
  VisualIdentityManifestSchema,
  type VisualIdentityManifest,
  type VisualIdentityModel,
} from "@/types/visual-identity";

const HARD_COST_CAP_USD = 2;

export interface UploadedAsset {
  variant: AssetVariant;
  url: string;
}

export interface AssembleManifestParams {
  uploads: UploadedAsset[];
  specs: AssetSpec[];
  estimate: CostEstimate;
  model: VisualIdentityModel;
  generatedAt: Date;
}

/**
 * Monta um `VisualIdentityManifest` válido a partir dos uploads + specs.
 * Função pura — fonte de verdade do mapping variant → manifest field.
 *
 * Lança se algum dos 3 assets non-categoria (hero/about/contact) estiver
 * faltando nos uploads — o caller deve garantir todos os specs subiram.
 */
export function assembleManifest(
  params: AssembleManifestParams,
): VisualIdentityManifest {
  const { uploads, specs, estimate, model, generatedAt } = params;
  const uploadByVariant = new Map<AssetVariant, string>(
    uploads.map((u) => [u.variant, u.url]),
  );

  const findOrThrow = (variant: AssetVariant): string => {
    const url = uploadByVariant.get(variant);
    if (!url) {
      throw new Error(
        `assembleManifest: missing upload for variant "${variant}"`,
      );
    }
    return url;
  };

  const categorySpecs = specs
    .filter((s) => s.manifestField === "categories_urls")
    .slice()
    .sort((a, b) => (a.categoryIndex ?? 0) - (b.categoryIndex ?? 0));

  const categoriesUrls = categorySpecs.map((spec) => findOrThrow(spec.key));

  return {
    hero_url: findOrThrow("hero"),
    about_url: findOrThrow("about"),
    contact_url: findOrThrow("contact"),
    categories_urls: categoriesUrls,
    generated_at: generatedAt.toISOString(),
    model,
    cost_estimate_brl: estimate.brl,
  };
}

interface LeadSiteRow {
  id: string;
  slug: string;
  user_id: string;
  variables: unknown;
  visual_identity: unknown | null;
}

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${message} [y/N] `);
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

async function runForRow(
  row: LeadSiteRow,
  options: { force: boolean; dryRun: boolean },
  supabase: SupabaseClient<Database>,
): Promise<void> {
  const { slug, user_id, variables, visual_identity } = row;

  if (visual_identity !== null && !options.force && !options.dryRun) {
    console.log(
      `\n[skip] ${slug} already has visual_identity. Re-run with --force to regenerate.`,
    );
    return;
  }

  const context = buildIdentityContext(variables);
  const cars = ((variables as { cars?: Array<{ category?: string }> })?.cars
    ?? []) as Array<{ category?: string }>;
  const specs = buildAssetSpecsForCars(cars);
  const estimate = estimateTotalCost(specs);
  const model: VisualIdentityModel =
    env.OPENAI_IMAGE_MODEL as VisualIdentityModel;

  if (options.dryRun) {
    console.log("\n=== Identity context ===");
    console.table([context]);
    console.log("\n=== Rendered prompts (--dry-run, no OpenAI calls) ===");
    for (const spec of specs) {
      console.log(
        `\n--- ${spec.key}  (${spec.size}, ${spec.quality}, manifest=${spec.manifestField}${spec.categoryIndex !== undefined ? `[${spec.categoryIndex}]` : ""}) ---`,
      );
      console.log(buildPrompt(spec, context));
    }
    console.log("\n[dry-run] No OpenAI calls made, no DB writes.");
    return;
  }

  console.log("\n=== Target ===");
  console.table([
    {
      slug,
      user_id,
      business_name: context.business_name,
      city_state: `${context.city ?? "?"}, ${context.state ?? "?"}`,
      primary_color: context.primary_color,
      cars_count: cars.length,
    },
  ]);

  console.log("\n=== Assets to generate ===");
  console.table(
    specs.map((s) => ({
      key: s.key,
      size: s.size,
      quality: s.quality,
      manifest_field: s.manifestField,
      category_index: s.categoryIndex ?? "",
    })),
  );

  console.log("\n=== Cost estimate ===");
  console.table([
    {
      model,
      assets: specs.length,
      usd: estimate.usd.toFixed(4),
      brl: estimate.brl.toFixed(2),
      brl_rate: env.BRL_RATE,
    },
  ]);

  if (estimate.usd > HARD_COST_CAP_USD) {
    console.error(
      `\nAbort: estimated cost $${estimate.usd.toFixed(4)} USD exceeds hard cap $${HARD_COST_CAP_USD}.`,
    );
    process.exit(1);
  }

  const ok = await confirm(
    `\nGenerate ${specs.length} images for "${context.business_name}" (slug=${slug})?`,
  );
  if (!ok) {
    console.log("Aborted by user.");
    return;
  }

  if (options.force) {
    console.log(`\nDeleting existing assets for slug=${slug}...`);
    await deleteExistingAssets(slug, supabase);
  }

  const limit = pLimit(env.OPENAI_IMAGE_CONCURRENCY);
  console.log(
    `\nGenerating ${specs.length} images with concurrency=${env.OPENAI_IMAGE_CONCURRENCY}...`,
  );

  const uploads: UploadedAsset[] = await Promise.all(
    specs.map((spec) =>
      limit(async () => {
        const prompt = buildPrompt(spec, context);
        const result = await generateImage({
          prompt,
          size: spec.size,
          quality: spec.quality,
          model,
        });
        const url = await uploadAssetToStorage({
          b64: result.b64,
          slug,
          key: spec.key,
          supabase,
        });
        console.log(`  · uploaded ${spec.key}`);
        return { variant: spec.key, url };
      }),
    ),
  );

  const manifest = assembleManifest({
    uploads,
    specs,
    estimate,
    model,
    generatedAt: new Date(),
  });

  VisualIdentityManifestSchema.parse(manifest);

  console.log("\nPersisting manifest to lead_sites.visual_identity...");
  const { error: updateError } = await supabase
    .from("lead_sites")
    .update({
      visual_identity: manifest,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug);

  if (updateError) {
    throw new Error(`Failed to persist manifest: ${updateError.message}`);
  }

  console.log("\n=== Manifest URLs ===");
  console.log(`  hero    : ${manifest.hero_url}`);
  console.log(`  about   : ${manifest.about_url}`);
  console.log(`  contact : ${manifest.contact_url}`);
  manifest.categories_urls.forEach((u, i) => {
    console.log(`  cat[${i}]  : ${u}`);
  });

  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  console.log(
    `\nDone. To invalidate the public site cache, run:\n` +
      `  curl '${appUrl}/api/dev/revalidate-site?slug=${slug}'`,
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const slug = argv.find((a) => !a.startsWith("--"));
  const force = argv.includes("--force");
  const dryRun = argv.includes("--dry-run");

  if (!slug) {
    console.error(
      "Usage: npx tsx scripts/run-visual-identity.ts <slug> [--force] [--dry-run]",
    );
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

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: row, error } = await supabase
    .from("lead_sites")
    .select("id, slug, user_id, variables, visual_identity")
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

  await runForRow(row as LeadSiteRow, { force, dryRun }, supabase);
}

const isDirectInvocation =
  process.argv[1] !== undefined &&
  process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  main().catch((err) => {
    console.error("\nUnhandled error:", err);
    process.exit(1);
  });
}
