/**
 * scripts/set-visual-identity.ts
 *
 * Persiste um `lead_sites.visual_identity` a partir de imagens locais
 * (já geradas manualmente — ChatGPT, Midjourney, etc). Faz upload pro
 * bucket `visual-identity/<slug>/*` e monta o manifest no shape
 * canônico (passa `VisualIdentityManifestSchema.parse`).
 *
 * Uso:
 *   npm run vi:set -- <slug> \
 *     --hero=/path/hero.png \
 *     --about=/path/about.png \
 *     --contact=/path/contact.png \
 *     --category-sedan=/path/sedan.png \
 *     [--category-suv=/path/suv.png ...]
 *
 * (Bare: `NODE_OPTIONS='--conditions=react-server' npx tsx scripts/set-visual-identity.ts ...` — npm script já injeta.)
 */

import "@/scripts/_bootstrap-env";

import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  uploadAssetToStorage,
  type AssetVariant,
} from "@/lib/sites/visual-identity";
import { assembleManifest, type UploadedAsset } from "@/scripts/run-visual-identity";
import type { Database } from "@/types/database";
import {
  VisualIdentityManifestSchema,
  type VisualIdentityModel,
} from "@/types/visual-identity";

const KNOWN_VARIANTS: AssetVariant[] = [
  "hero",
  "about",
  "contact",
  "category_suv",
  "category_sedan",
  "category_hatch",
  "category_pickup",
  "category_esportivo",
  "category_conversivel",
];
const KNOWN_VARIANTS_SET = new Set<string>(KNOWN_VARIANTS);

function flagToVariant(flag: string): AssetVariant | null {
  // --hero  -> hero
  // --category-sedan -> category_sedan
  const stripped = flag.replace(/^--/, "");
  const candidate = stripped.replace(/-/g, "_");
  if (KNOWN_VARIANTS_SET.has(candidate)) return candidate as AssetVariant;
  return null;
}

export interface ParsedSetArgs {
  slug: string;
  assets: Partial<Record<AssetVariant, string>>;
}

export function parseSetArgs(argv: string[]): ParsedSetArgs {
  let slug: string | null = null;
  const assets: Partial<Record<AssetVariant, string>> = {};

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      if (slug === null) {
        slug = arg;
      }
      continue;
    }

    const eqIndex = arg.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(`Flag ${arg} requires a value (use --flag=<path>)`);
    }

    const flagName = arg.slice(0, eqIndex);
    const value = arg.slice(eqIndex + 1);
    const variant = flagToVariant(flagName);
    if (!variant) {
      throw new Error(
        `Unknown flag ${flagName}. Known variants: ${KNOWN_VARIANTS.map((v) => `--${v.replace(/_/g, "-")}`).join(", ")}`,
      );
    }
    assets[variant] = value;
  }

  if (!slug) {
    throw new Error("Missing required <slug> positional argument");
  }
  return { slug, assets };
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

async function uploadLocal(
  path: string,
  slug: string,
  variant: AssetVariant,
  supabase: SupabaseClient<Database>,
): Promise<UploadedAsset> {
  const buffer = await readFile(path);
  const b64 = buffer.toString("base64");
  const url = await uploadAssetToStorage({ b64, slug, key: variant, supabase });
  return { variant, url };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { slug, assets } = parseSetArgs(argv);

  // Validate required non-category assets.
  for (const required of ["hero", "about", "contact"] as const) {
    if (!assets[required]) {
      console.error(
        `Missing required --${required}=<path>. Got: ${Object.keys(assets).join(", ") || "(none)"}`,
      );
      process.exit(1);
    }
  }
  const categoryEntries = Object.entries(assets).filter(([k]) =>
    k.startsWith("category_"),
  ) as Array<[AssetVariant, string]>;
  if (categoryEntries.length === 0) {
    console.error(
      "At least one --category-X=<path> is required (e.g. --category-sedan=...)",
    );
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    process.exit(1);
  }
  const supabase = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: row, error: fetchError } = await supabase
    .from("lead_sites")
    .select("slug, user_id, visual_identity")
    .eq("slug", slug)
    .maybeSingle();
  if (fetchError) {
    console.error("Supabase error:", fetchError.message);
    process.exit(1);
  }
  if (!row) {
    console.error(`No lead_site found for slug=${slug}`);
    process.exit(1);
  }

  console.log("\n=== Target ===");
  console.table([
    {
      slug,
      user_id: row.user_id,
      has_existing_manifest: row.visual_identity !== null,
      assets_to_upload: Object.keys(assets).length,
    },
  ]);

  console.log("\n=== Files ===");
  console.table(
    Object.entries(assets).map(([variant, path]) => ({ variant, path })),
  );

  if (row.visual_identity !== null) {
    console.warn(
      "\n[!] This site already has a visual_identity manifest — proceeding will overwrite it.",
    );
  }

  const ok = await confirm(
    `\nUpload ${Object.keys(assets).length} files and persist manifest for slug=${slug}?`,
  );
  if (!ok) {
    console.log("Aborted by user.");
    return;
  }

  console.log("\nUploading...");
  const uploads: UploadedAsset[] = [];
  for (const [variant, path] of Object.entries(assets) as Array<
    [AssetVariant, string]
  >) {
    const result = await uploadLocal(path, slug, variant, supabase);
    uploads.push(result);
    console.log(`  · uploaded ${variant}`);
  }

  // Specs synth: emulate buildAssetSpecsForCars output shape — we don't
  // need real specs for assembleManifest's cost data, but we do need
  // categoryIndex order matching the uploads. Use the order in which
  // the user passed --category-X flags as the manifest order.
  const specs = uploads.map((u) => {
    const isCategory = u.variant.startsWith("category_");
    return {
      key: u.variant,
      size: isCategory ? ("1024x1024" as const) : ("1536x1024" as const),
      quality: "medium" as const,
      manifestField: isCategory
        ? ("categories_urls" as const)
        : (`${u.variant}_url` as
            | "hero_url"
            | "about_url"
            | "contact_url"),
      ...(isCategory
        ? {
            categoryIndex: uploads
              .filter((x) => x.variant.startsWith("category_"))
              .findIndex((x) => x.variant === u.variant),
          }
        : {}),
    };
  });

  // Model is "manual" but the schema accepts only the two enum values.
  // We label as the V1 default since user-generated images are
  // indistinguishable from the pipeline output at this layer.
  const model: VisualIdentityModel = "gpt-image-2-2026-04-21";
  const manifest = assembleManifest({
    uploads,
    specs,
    estimate: { usd: 0, brl: 0 }, // manually generated, no API cost tracked here
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

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  console.log(
    `\nDone. To invalidate the public site cache, run:\n` +
      `  curl '${appUrl}/api/dev/revalidate-site?slug=${slug}'`,
  );
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
