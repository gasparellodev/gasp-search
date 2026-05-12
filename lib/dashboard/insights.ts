import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { LEAD_SOURCES, type LeadSource } from "@/lib/validators/leads";
import {
  FUNNEL_STAGES,
  type FunnelStage,
  type FunnelStageStat,
  type SourceBreakdownItem,
} from "@/lib/dashboard/types";

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

async function fetchLeadRows(
  supabase: SupabaseClient<Database>,
  context: string,
): Promise<Array<{ source: string; stage: string }>> {
  const result = await supabase.from("leads").select("source, stage");
  assertNoError(result, context);
  return (result.data ?? []) as Array<{ source: string; stage: string }>;
}

function isLeadSource(value: string): value is LeadSource {
  return (LEAD_SOURCES as readonly string[]).includes(value);
}

function isFunnelStage(value: string): value is FunnelStage {
  return (FUNNEL_STAGES as readonly string[]).includes(value);
}

/**
 * Agrupa leads por `source`, contando totais e `closed_won`.
 *
 * `conversionRate` é a fração de leads que viraram `closed_won` para
 * aquela origem (0..1). Linhas com `source` desconhecido (fora do enum)
 * são ignoradas — RLS já isola por `user_id` e o enum é validado na
 * inserção, mas o guard evita NaN caso o catálogo seja expandido.
 *
 * Ordenação: total desc, depois source asc — determinístico para UI e
 * testes.
 */
export async function getSourceBreakdown({
  supabase,
}: {
  supabase: SupabaseClient<Database>;
}): Promise<SourceBreakdownItem[]> {
  const rows = await fetchLeadRows(supabase, "fontes");

  const totals = new Map<LeadSource, { total: number; closedWon: number }>();
  for (const row of rows) {
    if (!isLeadSource(row.source)) continue;
    const bucket = totals.get(row.source) ?? { total: 0, closedWon: 0 };
    bucket.total += 1;
    if (row.stage === "closed_won") {
      bucket.closedWon += 1;
    }
    totals.set(row.source, bucket);
  }

  const items: SourceBreakdownItem[] = Array.from(totals.entries()).map(
    ([source, { total, closedWon }]) => ({
      source,
      total,
      closedWon,
      conversionRate: total > 0 ? closedWon / total : 0,
    }),
  );

  items.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.source.localeCompare(b.source);
  });

  return items;
}

/**
 * Funil de conversão por estágio (5 etapas).
 *
 * Apenas estágios "vivos" (`new → closed_won`) entram no funil — `closed_lost`
 * é tratado como fora do pipeline e ignorado.
 *
 * `dropRate[i]` representa a fração que não chegou à etapa atual vindo da
 * etapa anterior. Valor positivo = encolheu, negativo = cresceu. `null` na
 * primeira etapa (sem anterior) e quando a etapa anterior tem 0 leads (não
 * faz sentido calcular proporção sobre divisão por zero).
 */
export async function getFunnelStats({
  supabase,
}: {
  supabase: SupabaseClient<Database>;
}): Promise<FunnelStageStat[]> {
  const rows = await fetchLeadRows(supabase, "funil");

  const counts: Record<FunnelStage, number> = {
    new: 0,
    contacted: 0,
    in_conversation: 0,
    qualified: 0,
    closed_won: 0,
  };

  for (const row of rows) {
    if (isFunnelStage(row.stage)) {
      counts[row.stage] += 1;
    }
  }

  return FUNNEL_STAGES.map((stage, index): FunnelStageStat => {
    if (index === 0) {
      return { stage, count: counts[stage], dropRate: null };
    }
    const prev = FUNNEL_STAGES[index - 1] as FunnelStage;
    const prevCount = counts[prev];
    const currCount = counts[stage];
    const dropRate = prevCount > 0 ? (prevCount - currCount) / prevCount : null;
    return { stage, count: currCount, dropRate };
  });
}
