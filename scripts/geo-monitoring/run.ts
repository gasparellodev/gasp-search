/**
 * Phase 7 / Frente 04 GEO/AI — #G5
 * Brand mention monitoring script.
 *
 * Usage:
 *   npm run geo:monitor
 *   tsx scripts/geo-monitoring/run.ts
 *
 * For each published/sent lead_site with a signed_at timestamp:
 *   1. Generates up to 5 amostral queries from site variables.
 *   2. Checks each query via the configured MonitoringProvider.
 *   3. Persists results to lead_sites_geo_monitoring (service-role, bypasses RLS).
 *   4. Writes a markdown report to docs/geo-monitoring/YYYY-MM-DD-report.md.
 *
 * V1 uses MockMonitoringProvider (cited=false). Configure a real provider
 * (Perplexity, DataForSEO) when API keys are available.
 *
 * DO NOT run in CI — writes to real DB and external APIs.
 */

import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Path aliases are resolved by tsx via tsconfig paths
import { createServiceSupabase } from "@/lib/supabase/service";
import { buildAmostralQueries } from "@/lib/geo/monitoring/queries";
import {
  MockMonitoringProvider,
  type MonitoringProvider,
} from "@/lib/geo/monitoring/provider";
import { renderReport, type ReportEntry } from "@/lib/geo/monitoring/report";
import { readSiteVariablesSafe } from "@/lib/sites/migrate-variables";

// ---------------------------------------------------------------------------
// Provider selection — swap MockMonitoringProvider for a real one here when
// PERPLEXITY_API_KEY / DATAFORSEO credentials are configured.
// ---------------------------------------------------------------------------
const provider: MonitoringProvider = new MockMonitoringProvider();

async function main(): Promise<void> {
  const supabase = createServiceSupabase();

  console.log(
    `[geo-monitor] starting — provider="${provider.source}" date="${new Date().toISOString()}"`,
  );

  // Fetch all published/sent sites that have been signed (publicly indexed)
  const { data: sites, error } = await supabase
    .from("lead_sites")
    .select("id, slug, variables")
    .in("status", ["published", "sent"])
    .not("signed_at", "is", null);

  if (error !== null) {
    console.error("[geo-monitor] failed to load sites:", error.message);
    process.exit(1);
  }

  console.log(`[geo-monitor] ${sites.length} sites to check`);

  const allEntries: ReportEntry[] = [];
  let skippedCount = 0;
  let insertErrorCount = 0;

  for (const site of sites) {
    const parsed = readSiteVariablesSafe(site.variables);

    if (!parsed.success) {
      console.warn(
        `[geo-monitor] skipping site "${site.slug}" — variables failed validation:`,
        parsed.error.issues[0]?.message ?? "unknown error",
      );
      skippedCount++;
      continue;
    }

    const queries = buildAmostralQueries(parsed.data);
    const domain = `gasplab.com.br/sites/${site.slug}`;

    for (const query of queries) {
      let result;
      try {
        result = await provider.check(query, domain);
      } catch (checkErr) {
        console.warn(
          `[geo-monitor] provider.check failed for site "${site.slug}" query "${query}":`,
          checkErr instanceof Error ? checkErr.message : String(checkErr),
        );
        continue;
      }

      // NOTE: types/database.ts predates migration 0024 and does not include
      // lead_sites_geo_monitoring yet. Cast to `unknown` then retyped via
      // supabase-js's generic overload until `npm run gen:types` is re-run
      // after the migration is applied to the remote project.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase as any)
        .from("lead_sites_geo_monitoring")
        .insert({
          lead_site_id: site.id,
          query: result.query,
          source: result.source,
          cited: result.cited,
          snippet: result.snippet,
          checked_at: result.checked_at.toISOString(),
        });

      if (insertError !== null) {
        console.warn(
          `[geo-monitor] insert failed for site "${site.slug}":`,
          insertError.message,
        );
        insertErrorCount++;
      }

      allEntries.push({
        ...result,
        lead_site_id: site.id,
        business_name: parsed.data.business_name ?? site.slug,
      });
    }
  }

  // Write markdown report
  const reportDir = join(process.cwd(), "docs", "geo-monitoring");
  await mkdir(reportDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const reportPath = join(reportDir, `${today}-report.md`);
  await writeFile(reportPath, renderReport(allEntries), "utf-8");

  console.log(`[geo-monitor] report written: ${reportPath}`);
  console.log(`[geo-monitor] summary:`);
  console.log(`  sites checked : ${sites.length - skippedCount}`);
  console.log(`  sites skipped : ${skippedCount}`);
  console.log(`  queries run   : ${allEntries.length}`);
  console.log(`  insert errors : ${insertErrorCount}`);
  console.log(
    `  cited         : ${allEntries.filter((e) => e.cited).length} / ${allEntries.length}`,
  );
}

main().catch((err: unknown) => {
  console.error(
    "[geo-monitor] fatal:",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
