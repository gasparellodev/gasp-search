import { beforeEach, describe, expect, it, vi } from "vitest";
import { autoEnrichGoogleMapsJob } from "@/lib/apify/auto-enrich";

const enrichMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apify/enrich", () => ({
  enrichLeadsByUrls: enrichMock,
}));

function makeSupabase(rows: Array<{ id: string; website: string | null; email: string | null }>) {
  const eq2 = vi.fn(async () => ({ data: rows, error: null }));
  const eq1 = vi.fn(() => ({ eq: eq2 }));
  const select = vi.fn(() => ({ eq: eq1 }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { from } as unknown as Parameters<
      typeof autoEnrichGoogleMapsJob
    >[0]["supabase"],
    spies: { from, select, eq1, eq2 },
  };
}

beforeEach(() => {
  enrichMock.mockReset();
});

describe("autoEnrichGoogleMapsJob", () => {
  it("dispara enrich apenas para leads com website mas sem email", async () => {
    const supa = makeSupabase([
      { id: "lead-1", website: "bigode.com.br", email: null },
      { id: "lead-2", website: "esteticamaria.com.br", email: null },
      { id: "lead-3", website: null, email: null },
      { id: "lead-4", website: "outro.com", email: "ja@tem.com" },
    ]);
    enrichMock.mockResolvedValue({
      enrichedCount: 2,
      enrichedLeadIds: ["lead-1", "lead-2"],
      skippedUrls: [],
    });

    const result = await autoEnrichGoogleMapsJob({
      supabase: supa.client,
      userId: "user-1",
      jobId: "job-gmaps",
    });

    expect(supa.spies.from).toHaveBeenCalledWith("leads");
    expect(supa.spies.eq1).toHaveBeenCalledWith(
      "source_search_job_id",
      "job-gmaps",
    );
    expect(supa.spies.eq2).toHaveBeenCalledWith("source", "google_maps");

    expect(enrichMock).toHaveBeenCalledTimes(1);
    const arg = enrichMock.mock.calls[0]![0];
    expect(arg.urls).toEqual(["bigode.com.br", "esteticamaria.com.br"]);
    expect(result.enrichedCount).toBe(2);
  });

  it("não chama enrich quando todos os leads já têm email ou nenhum tem website", async () => {
    const supa = makeSupabase([
      { id: "lead-1", website: null, email: null },
      { id: "lead-2", website: "x.com", email: "ja@tem.com" },
    ]);

    const result = await autoEnrichGoogleMapsJob({
      supabase: supa.client,
      userId: "user-1",
      jobId: "job-gmaps",
    });

    expect(enrichMock).not.toHaveBeenCalled();
    expect(result.enrichedCount).toBe(0);
  });

  it("falha do enrich não propaga — captura e devolve enrichedCount=0", async () => {
    const supa = makeSupabase([
      { id: "lead-1", website: "bigode.com.br", email: null },
    ]);
    enrichMock.mockRejectedValue(new Error("apify down"));

    const result = await autoEnrichGoogleMapsJob({
      supabase: supa.client,
      userId: "user-1",
      jobId: "job-gmaps",
    });

    expect(result.enrichedCount).toBe(0);
    expect(result.error).toContain("apify down");
  });

  it("falha do supabase também é capturada (não propaga)", async () => {
    const eq2 = vi.fn(async () => ({
      data: null,
      error: { message: "rls" },
    }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const from = vi.fn(() => ({ select }));
    const client = { from } as unknown as Parameters<
      typeof autoEnrichGoogleMapsJob
    >[0]["supabase"];

    const result = await autoEnrichGoogleMapsJob({
      supabase: client,
      userId: "user-1",
      jobId: "job-gmaps",
    });
    expect(result.enrichedCount).toBe(0);
    expect(result.error).toContain("rls");
  });
});
