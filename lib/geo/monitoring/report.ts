import "server-only";

// ===========================================================================
// Phase 7 / Frente 04 GEO/AI — #G5
// Markdown report renderer for brand mention monitoring results.
// ===========================================================================

import type { MonitoringResult } from "./provider";

export interface ReportEntry extends MonitoringResult {
  lead_site_id: string;
  business_name: string;
}

const SNIPPET_MAX_LENGTH = 80;

/**
 * Renders a markdown report grouping results by lead_site_id.
 *
 * Output is deterministic given the same input — results are presented
 * in insertion order (the orchestrator controls ordering).
 */
export function renderReport(entries: ReportEntry[]): string {
  const today = new Date().toISOString().slice(0, 10);

  // Group by lead_site_id preserving insertion order
  const grouped = new Map<string, ReportEntry[]>();
  for (const entry of entries) {
    const existing = grouped.get(entry.lead_site_id);
    if (existing !== undefined) {
      existing.push(entry);
    } else {
      grouped.set(entry.lead_site_id, [entry]);
    }
  }

  const totalSites = grouped.size;
  const totalQueries = entries.length;
  const totalCited = entries.filter((e) => e.cited).length;

  let md = `# Brand Mention Monitoring Report — ${today}\n\n`;
  md += `**Sites verificados:** ${totalSites}  \n`;
  md += `**Total de queries:** ${totalQueries}  \n`;
  md += `**Menções encontradas:** ${totalCited} / ${totalQueries}\n\n`;
  md += `---\n\n`;
  md += `## Resultados por site\n\n`;

  for (const [siteId, results] of grouped) {
    const firstName = results[0]?.business_name ?? "(desconhecido)";
    const citedCount = results.filter((r) => r.cited).length;
    md += `### ${firstName} (\`${siteId}\`) — ${citedCount}/${results.length} menções\n\n`;
    md += `| Query | Source | Citado | Snippet |\n`;
    md += `|---|---|---|---|\n`;

    for (const r of results) {
      const snippet =
        r.snippet !== null
          ? r.snippet.slice(0, SNIPPET_MAX_LENGTH).replace(/\n/g, " ")
          : "—";
      const citedEmoji = r.cited ? "✅" : "❌";
      // Escape pipe characters inside cells to avoid breaking markdown table
      const safeQuery = r.query.replace(/\|/g, "\\|");
      const safeSnippet = snippet.replace(/\|/g, "\\|");
      md += `| ${safeQuery} | ${r.source} | ${citedEmoji} | ${safeSnippet} |\n`;
    }

    md += "\n";
  }

  md += `---\n\n`;
  md += `> Gerado em ${new Date().toISOString()} por \`npm run geo:monitor\`.\n`;
  md += `> V1: provider \`mock\` — configure \`PERPLEXITY_API_KEY\` para menções reais.\n`;

  return md;
}
