import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderReport } from "@/lib/geo/monitoring/report";
import type { ReportEntry } from "@/lib/geo/monitoring/report";

function makeEntry(overrides: Partial<ReportEntry> = {}): ReportEntry {
  return {
    lead_site_id: "site-uuid-1",
    business_name: "Touring Cars",
    query: "Touring Cars Recife",
    source: "mock",
    cited: false,
    snippet: null,
    checked_at: new Date("2026-05-17T12:00:00.000Z"),
    ...overrides,
  };
}

describe("renderReport", () => {
  let fixedDate: Date;

  beforeEach(() => {
    fixedDate = new Date("2026-05-17T14:30:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("includes today's date in the title", () => {
    const md = renderReport([makeEntry()]);
    expect(md).toContain("2026-05-17");
  });

  it("includes total sites checked count", () => {
    const entries = [
      makeEntry({ lead_site_id: "site-1", business_name: "Loja A" }),
      makeEntry({ lead_site_id: "site-2", business_name: "Loja B" }),
    ];
    const md = renderReport(entries);
    expect(md).toContain("2");
  });

  it("includes total queries count", () => {
    const entries = [
      makeEntry({ query: "q1" }),
      makeEntry({ query: "q2" }),
      makeEntry({ query: "q3" }),
    ];
    const md = renderReport(entries);
    expect(md).toContain("3");
  });

  it("groups results by lead_site_id", () => {
    const entries = [
      makeEntry({ lead_site_id: "site-1", business_name: "Loja A", query: "q1" }),
      makeEntry({ lead_site_id: "site-1", business_name: "Loja A", query: "q2" }),
      makeEntry({ lead_site_id: "site-2", business_name: "Loja B", query: "q3" }),
    ];
    const md = renderReport(entries);
    expect(md).toContain("Loja A");
    expect(md).toContain("Loja B");
    // Both site-ids appear
    expect(md).toContain("site-1");
    expect(md).toContain("site-2");
  });

  it("renders cited count per site", () => {
    const entries = [
      makeEntry({ lead_site_id: "site-1", cited: true, query: "q1" }),
      makeEntry({ lead_site_id: "site-1", cited: false, query: "q2" }),
      makeEntry({ lead_site_id: "site-1", cited: true, query: "q3" }),
    ];
    const md = renderReport(entries);
    // 2 cited out of 3 for site-1
    expect(md).toContain("2/3");
  });

  it("renders ✅ for cited=true and ❌ for cited=false", () => {
    const entries = [
      makeEntry({ cited: true }),
      makeEntry({ cited: false, query: "other query" }),
    ];
    const md = renderReport(entries);
    expect(md).toContain("✅");
    expect(md).toContain("❌");
  });

  it("truncates long snippets to 80 characters", () => {
    const longSnippet = "A".repeat(200);
    const md = renderReport([makeEntry({ snippet: longSnippet, cited: true })]);
    // Should NOT contain the full 200-char string
    expect(md).not.toContain("A".repeat(200));
    // Should contain first 80 chars
    expect(md).toContain("A".repeat(80));
  });

  it("renders — for null snippets", () => {
    const md = renderReport([makeEntry({ snippet: null })]);
    expect(md).toContain("—");
  });

  it("renders non-null snippets (short) fully", () => {
    const snippet = "Ótima concessionária em Recife";
    const md = renderReport([makeEntry({ snippet, cited: true })]);
    expect(md).toContain(snippet);
  });

  it("returns a valid markdown string with table headers", () => {
    const md = renderReport([makeEntry()]);
    expect(md).toContain("| Query |");
    expect(md).toContain("| Source |");
    expect(md).toContain("| Citado |");
    expect(md).toContain("| Snippet |");
  });

  it("handles empty entries list gracefully", () => {
    const md = renderReport([]);
    expect(md).toContain("2026-05-17");
    expect(md).toContain("0");
    expect(typeof md).toBe("string");
  });

  it("escapes pipe characters in query to avoid broken table", () => {
    const md = renderReport([
      makeEntry({ query: "Toyota | Honda" }),
    ]);
    // Escaped pipe should appear, not raw pipe breaking the table
    expect(md).toContain("Toyota \\| Honda");
  });
});
