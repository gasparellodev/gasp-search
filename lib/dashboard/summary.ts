import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { LEAD_STAGES, type LeadStage } from "@/lib/validators/leads";
import type { DashboardCounters } from "@/lib/dashboard/types";

function emptyStageCounts(): Record<LeadStage, number> {
  return {
    new: 0,
    contacted: 0,
    in_conversation: 0,
    qualified: 0,
    closed_won: 0,
    closed_lost: 0,
  };
}

function assertNoError(
  result: { error: { message: string } | null },
  context: string,
) {
  if (result.error) {
    throw new Error(
      `Falha ao carregar dashboard (${context}): ${result.error.message}`,
    );
  }
}

export async function getDashboardSummary({
  supabase,
  now = new Date(),
}: {
  supabase: SupabaseClient<Database>;
  now?: Date;
}): Promise<DashboardCounters> {
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

  const totalResult = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true });
  assertNoError(totalResult, "total de leads");

  const newResult = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo.toISOString());
  assertNoError(newResult, "leads novos");

  const stageResult = await supabase.from("leads").select("stage");
  assertNoError(stageResult, "estágios");

  const leadsByStage = emptyStageCounts();
  for (const row of stageResult.data ?? []) {
    if ((LEAD_STAGES as readonly string[]).includes(row.stage)) {
      leadsByStage[row.stage] += 1;
    }
  }

  const searchesResult = await supabase
    .from("search_jobs")
    .select(
      "id, source, status, results_count, error_message, created_at, finished_at",
    )
    .order("created_at", { ascending: false })
    .limit(5);
  assertNoError(searchesResult, "últimas buscas");

  return {
    totalLeads: totalResult.count ?? 0,
    newLeadsLast7Days: newResult.count ?? 0,
    leadsByStage,
    recentSearches: (searchesResult.data ?? []).map((job) => ({
      id: job.id,
      source: job.source,
      status: job.status,
      resultsCount: job.results_count,
      errorMessage: job.error_message,
      createdAt: job.created_at,
      finishedAt: job.finished_at,
    })),
  };
}
