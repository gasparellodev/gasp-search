/**
 * scripts/seed-default-visual-identity.ts
 *
 * Replica a identidade visual canônica (hoje: `4t3xswas-ducarmo-veiculos`)
 * pra `visual-identity/_defaults/v1/` com nomes limpos (sem timestamps),
 * criando a fonte estável dos defaults runtime consumidos por
 * `lib/sites/default-visual-identity.ts` (WP4).
 *
 * Uso:
 *   npx tsx scripts/seed-default-visual-identity.ts [--dry-run]
 *
 * Idempotente: upsert garante que rodar várias vezes é no-op.
 *
 * Side-effect: lê/escreve no bucket `visual-identity` via service_role.
 */

import "@/scripts/_bootstrap-env";

import { fileURLToPath } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SOURCE_BUCKET = "visual-identity";
const SOURCE_PREFIX = "4t3xswas-ducarmo-veiculos";
const DESTINATION_PREFIX = "_defaults/v1";

const KNOWN_VARIANTS = [
  "hero",
  "about",
  "contact",
  "category_sedan",
  "category_suv",
  "category_hatch",
  "category_pickup",
  "category_esportivo",
  "category_conversivel",
] as const;

type KnownVariant = (typeof KNOWN_VARIANTS)[number];

const CATEGORY_ORDER: KnownVariant[] = [
  "category_sedan",
  "category_suv",
  "category_hatch",
  "category_pickup",
  "category_esportivo",
  "category_conversivel",
];

const KNOWN_VARIANTS_SET = new Set<string>(KNOWN_VARIANTS);

export interface ParsedFilename {
  variant: string;
  ext: string;
}

export interface SeedArgs {
  dryRun: boolean;
}

export interface DefaultManifest {
  hero_url: string | null;
  about_url: string | null;
  contact_url: string | null;
  categories_urls: string[];
}

export function parseSeedArgs(argv: string[]): SeedArgs {
  return { dryRun: argv.includes("--dry-run") };
}

export function parseSourceFilename(input: string): ParsedFilename | null {
  const filename = input.includes("/")
    ? (input.split("/").pop() ?? "")
    : input;
  if (!filename) return null;
  const match = filename.match(/^([a-z][a-z_]*?)(?:-\d+)?\.([a-z0-9]+)$/i);
  if (!match) return null;
  const rawVariant = match[1]?.toLowerCase();
  const ext = match[2]?.toLowerCase();
  if (!rawVariant || !ext) return null;
  if (!KNOWN_VARIANTS_SET.has(rawVariant)) return null;
  return { variant: rawVariant, ext };
}

export function buildDestinationPath(parsed: ParsedFilename): string {
  const cleanVariant = parsed.variant.replace(/_/g, "-");
  return `${DESTINATION_PREFIX}/${cleanVariant}.${parsed.ext}`;
}

export function buildDefaultManifest(
  baseUrl: string,
  copiedPaths: string[],
): DefaultManifest {
  const byFilename = new Map<string, string>();
  for (const path of copiedPaths) {
    const filename = path.split("/").pop();
    if (!filename) continue;
    byFilename.set(filename, `${baseUrl.replace(/\/$/, "")}/${filename}`);
  }

  const findFor = (variant: string): string | null => {
    const prefix = variant.replace(/_/g, "-");
    for (const [filename, url] of byFilename.entries()) {
      if (filename.startsWith(`${prefix}.`)) return url;
    }
    return null;
  };

  const categories: string[] = [];
  for (const cat of CATEGORY_ORDER) {
    const url = findFor(cat);
    if (url) categories.push(url);
  }

  return {
    hero_url: findFor("hero"),
    about_url: findFor("about"),
    contact_url: findFor("contact"),
    categories_urls: categories,
  };
}

async function listSourceFiles(
  client: SupabaseClient,
): Promise<{ name: string }[]> {
  const { data, error } = await client.storage
    .from(SOURCE_BUCKET)
    .list(SOURCE_PREFIX, { limit: 200, offset: 0 });
  if (error) {
    throw new Error(`Failed to list source folder: ${error.message}`);
  }
  const items = data ?? [];
  return items
    .filter((f) => typeof f?.name === "string" && f.name.length > 0)
    .map((f) => ({ name: f.name }));
}

async function copyOne(
  client: SupabaseClient,
  source: { name: string },
  destination: string,
  dryRun: boolean,
): Promise<{ copied: boolean; bytes: number }> {
  const srcPath = `${SOURCE_PREFIX}/${source.name}`;
  if (dryRun) {
    return { copied: false, bytes: 0 };
  }
  const { data: blob, error: dlError } = await client.storage
    .from(SOURCE_BUCKET)
    .download(srcPath);
  if (dlError || !blob) {
    throw new Error(
      `Download failed for ${srcPath}: ${dlError?.message ?? "no blob"}`,
    );
  }
  const buffer = Buffer.from(await blob.arrayBuffer());
  const { error: upError } = await client.storage
    .from(SOURCE_BUCKET)
    .upload(destination, buffer, {
      upsert: true,
      contentType: blob.type || "application/octet-stream",
    });
  if (upError) {
    throw new Error(`Upload failed for ${destination}: ${upError.message}`);
  }
  return { copied: true, bytes: buffer.byteLength };
}

async function main(): Promise<void> {
  const args = parseSeedArgs(process.argv.slice(2));

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
    `[seed] source: ${SOURCE_BUCKET}/${SOURCE_PREFIX}, destination: ${SOURCE_BUCKET}/${DESTINATION_PREFIX}${args.dryRun ? " (DRY RUN)" : ""}`,
  );

  const files = await listSourceFiles(client);
  console.log(`[seed] found ${files.length} file(s) in source folder`);

  const copiedPaths: string[] = [];
  for (const file of files) {
    const parsed = parseSourceFilename(file.name);
    if (!parsed) {
      console.warn(`[skip] ${file.name} — unknown variant`);
      continue;
    }
    const dest = buildDestinationPath(parsed);
    const result = await copyOne(client, file, dest, args.dryRun);
    if (result.copied) {
      console.log(
        `[copy] ${SOURCE_PREFIX}/${file.name} → ${dest} (${result.bytes}B)`,
      );
    } else {
      console.log(
        `[dry]  ${SOURCE_PREFIX}/${file.name} → ${dest}`,
      );
    }
    copiedPaths.push(dest);
  }

  const baseUrl = `${url.replace(/\/$/, "")}/storage/v1/object/public/${SOURCE_BUCKET}/${DESTINATION_PREFIX}`;
  const manifest = buildDefaultManifest(baseUrl, copiedPaths);
  console.log("[seed] manifest (paste into lib/sites/default-visual-identity.ts):");
  console.log(JSON.stringify(manifest, null, 2));
}

const isDirectInvoke =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectInvoke) {
  main().catch((err) => {
    console.error("[seed] fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
