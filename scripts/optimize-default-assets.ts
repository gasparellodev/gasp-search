/**
 * scripts/optimize-default-assets.ts
 *
 * Lê os arquivos PNG em `visual-identity/_defaults/v1/*.png` (seedados pelo
 * `seed-default-visual-identity.ts` em WP3), gera variantes AVIF e WebP em
 * 3 larguras (640, 1280, 1920) via `sharp` e re-uploada pro mesmo prefixo
 * com sufixo `-<width>.<ext>` — pra que o consumer use `<picture>` +
 * `srcset` em vez de servir o PNG original de ~2MB.
 *
 * Uso:
 *   npx tsx scripts/optimize-default-assets.ts [--dry-run]
 *
 * Idempotente via `upsert:true`.
 *
 * Side-effect: lê/escreve no bucket `visual-identity` via service_role.
 */

import "@/scripts/_bootstrap-env";

import { fileURLToPath } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "visual-identity";
const PREFIX = "_defaults/v1";
const WIDTHS = [640, 1280, 1920] as const;
const AVIF_QUALITY = 60;
const WEBP_QUALITY = 80;

const KNOWN_SOURCES = [
  "hero.png",
  "about.png",
  "contact.png",
  "category-sedan.png",
] as const;

type Variant = "avif" | "webp";

export interface OptimizeArgs {
  dryRun: boolean;
}

export interface OptimizedAsset {
  source: string;
  variant: Variant;
  width: number;
  destination: string;
  bytes: number;
}

export function parseOptimizeArgs(argv: string[]): OptimizeArgs {
  return { dryRun: argv.includes("--dry-run") };
}

/**
 * Deriva o destino baseado no nome do source. `hero.png` + 1280w + avif →
 * `_defaults/v1/hero-1280.avif`.
 */
export function buildOptimizedPath(
  sourceName: string,
  width: number,
  variant: Variant,
): string {
  const base = sourceName.replace(/\.[a-z0-9]+$/i, "");
  return `${PREFIX}/${base}-${width}.${variant}`;
}

/**
 * Gera o `srcset` HTML padrão pra um source name dado.
 * Ex: `buildSrcset("hero", "avif", baseUrl)` → "<base>/hero-640.avif 640w, ..."
 */
export function buildSrcsetString(
  baseUrl: string,
  variantBaseName: string,
  variant: Variant,
): string {
  return WIDTHS.map(
    (w) => `${baseUrl.replace(/\/$/, "")}/${variantBaseName}-${w}.${variant} ${w}w`,
  ).join(", ");
}

async function optimizeBuffer(
  input: Buffer,
  width: number,
  variant: Variant,
): Promise<Buffer> {
  const pipeline = sharp(input).resize({ width, withoutEnlargement: true });
  if (variant === "avif") {
    return pipeline.avif({ quality: AVIF_QUALITY, effort: 5 }).toBuffer();
  }
  return pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
}

async function processOne(
  client: SupabaseClient,
  sourceName: string,
  dryRun: boolean,
): Promise<OptimizedAsset[]> {
  const srcPath = `${PREFIX}/${sourceName}`;
  const { data: blob, error: dlError } = await client.storage
    .from(BUCKET)
    .download(srcPath);
  if (dlError || !blob) {
    throw new Error(
      `Download failed for ${srcPath}: ${dlError?.message ?? "no blob"}`,
    );
  }
  const buffer = Buffer.from(await blob.arrayBuffer());
  const results: OptimizedAsset[] = [];

  for (const width of WIDTHS) {
    for (const variant of ["avif", "webp"] as const) {
      const optimized = await optimizeBuffer(buffer, width, variant);
      const dest = buildOptimizedPath(sourceName, width, variant);
      if (!dryRun) {
        const { error: upError } = await client.storage
          .from(BUCKET)
          .upload(dest, optimized, {
            upsert: true,
            contentType: variant === "avif" ? "image/avif" : "image/webp",
          });
        if (upError) {
          throw new Error(`Upload failed for ${dest}: ${upError.message}`);
        }
      }
      results.push({
        source: sourceName,
        variant,
        width,
        destination: dest,
        bytes: optimized.byteLength,
      });
    }
  }
  return results;
}

async function main(): Promise<void> {
  const args = parseOptimizeArgs(process.argv.slice(2));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    process.exit(1);
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  console.log(
    `[optimize] target: ${BUCKET}/${PREFIX}/${args.dryRun ? " (DRY RUN)" : ""}`,
  );

  const allResults: OptimizedAsset[] = [];
  for (const sourceName of KNOWN_SOURCES) {
    console.log(`[optimize] processing ${sourceName}...`);
    const results = await processOne(client, sourceName, args.dryRun);
    for (const r of results) {
      console.log(
        `${args.dryRun ? "[dry]   " : "[upload]"} ${r.destination} (${(r.bytes / 1024).toFixed(1)}KB)`,
      );
    }
    allResults.push(...results);
  }

  // Summary table
  console.log("\n[optimize] Size summary (KB):");
  for (const sourceName of KNOWN_SOURCES) {
    const rows = allResults.filter((r) => r.source === sourceName);
    const cols = WIDTHS.map((w) => {
      const avif = rows.find((r) => r.width === w && r.variant === "avif");
      const webp = rows.find((r) => r.width === w && r.variant === "webp");
      return `${w}w: ${avif ? Math.round(avif.bytes / 1024) : "?"}/${webp ? Math.round(webp.bytes / 1024) : "?"}`;
    });
    console.log(`  ${sourceName.padEnd(20)} AVIF/WebP — ${cols.join("  |  ")}`);
  }
}

const isDirectInvoke =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectInvoke) {
  main().catch((err) => {
    console.error(
      "[optimize] fatal:",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  });
}
