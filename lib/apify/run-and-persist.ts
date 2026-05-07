import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, TablesInsert } from "@/types/database";
import { getApify } from "@/lib/apify/client";

export interface MapperContext {
  userId: string;
  jobId: string;
  source: Enums<"search_source">;
}

export type LeadInsert = TablesInsert<"leads">;

export interface RunAndPersistInput<TItem> {
  supabase: SupabaseClient<Database>;
  userId: string;
  source: Enums<"search_source">;
  actorId: string;
  input: Record<string, unknown>;
  mapper: (item: TItem, ctx: MapperContext) => LeadInsert | null;
  /**
   * Como dedup-ar leads no upsert. Default: `user_id,source,website` se
   * presente, senão `user_id,source,instagram_handle`. Use string customizada
   * para fontes específicas.
   */
  onConflict?: string;
}

export interface RunAndPersistResult {
  jobId: string;
  status: "succeeded" | "failed";
  leadsCount: number;
}

// ---------------------------------------------------------------------------
// createSearchJob — cria search_job (queued) e retorna jobId.
// Rápido, sem bloqueio. Usado pelo fluxo assíncrono.
// ---------------------------------------------------------------------------

export interface CreateSearchJobInput {
  supabase: SupabaseClient<Database>;
  userId: string;
  source: Enums<"search_source">;
  input: Record<string, unknown>;
}

export async function createSearchJob(
  args: CreateSearchJobInput,
): Promise<string> {
  const { supabase, userId, source, input } = args;

  const { data: createdJob, error: insertErr } = await supabase
    .from("search_jobs")
    .insert({
      user_id: userId,
      source,
      input: input as never,
      status: "queued",
    })
    .select()
    .single();

  if (insertErr || !createdJob) {
    throw new Error(
      `Falha ao criar search_job: ${insertErr?.message ?? "unknown"}`,
    );
  }

  return createdJob.id as string;
}

// ---------------------------------------------------------------------------
// executeSearchJob — executa actor Apify, lê dataset, mapeia e persiste leads.
// Lento (2-5 min). Projetado para rodar em background via after().
// ---------------------------------------------------------------------------

export interface ExecuteSearchJobInput<TItem> {
  supabase: SupabaseClient<Database>;
  userId: string;
  jobId: string;
  source: Enums<"search_source">;
  actorId: string;
  input: Record<string, unknown>;
  mapper: (item: TItem, ctx: MapperContext) => LeadInsert | null;
  onConflict?: string;
}

export async function executeSearchJob<TItem = unknown>(
  args: ExecuteSearchJobInput<TItem>,
): Promise<RunAndPersistResult> {
  const { supabase, userId, jobId, source, actorId, input, mapper, onConflict } =
    args;

  try {
    // 1. running
    await supabase
      .from("search_jobs")
      .update({ status: "running" })
      .eq("id", jobId);

    // 2. call actor (síncrono — leva minutos).
    const apify = getApify();
    const run = await apify.actor(actorId).call(input);

    // 3. read dataset
    const { items } = await apify
      .dataset(run.defaultDatasetId)
      .listItems();

    // 4. map → deduplicate → upsert
    const rawLeads: LeadInsert[] = [];
    for (const item of items as TItem[]) {
      const mapped = mapper(item, { userId, jobId, source });
      if (mapped) rawLeads.push(mapped);
    }

    const leads: LeadInsert[] = [];
    if (rawLeads.length > 0) {
      const conflictKeys = (onConflict ?? "user_id,source,website").split(",");
      const uniqueLeadsMap = new Map<string, LeadInsert>();

      for (const lead of rawLeads) {
        const hasNullKey = conflictKeys.some(
          (k) => lead[k as keyof LeadInsert] == null,
        );
        if (hasNullKey) {
          // In Postgres, UNIQUE constraints with nulls treat each null as distinct.
          // We must NOT deduplicate them, otherwise we lose valid leads.
          leads.push(lead);
        } else {
          // Non-null keys must be deduplicated to avoid "cannot affect row a second time"
          const mapKey = conflictKeys
            .map((k) => String(lead[k as keyof LeadInsert]))
            .join("|");
          // Keep the first one found (or we could keep the last, it doesn't matter much)
          if (!uniqueLeadsMap.has(mapKey)) {
            uniqueLeadsMap.set(mapKey, lead);
          }
        }
      }
      leads.push(...uniqueLeadsMap.values());
    }

    if (leads.length > 0) {
      const { error: upsertErr } = await supabase
        .from("leads")
        .upsert(leads, {
          onConflict:
            onConflict ?? "user_id,source,website",
          ignoreDuplicates: false,
        });
      if (upsertErr) {
        throw new Error(`Falha ao gravar leads: ${upsertErr.message}`);
      }
    }

    // 5. succeeded
    await supabase
      .from("search_jobs")
      .update({
        status: "succeeded",
        results_count: leads.length,
        finished_at: new Date().toISOString(),
        apify_run_id: run.id ?? null,
      })
      .eq("id", jobId);

    return { jobId, status: "succeeded", leadsCount: leads.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("search_jobs")
      .update({
        status: "failed",
        error_message: message,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// runAndPersist — conveniência que chama createSearchJob + executeSearchJob
// em sequência. Mantido para compatibilidade (ex.: Instagram route).
// ---------------------------------------------------------------------------

/**
 * Padrão único de execução de actor Apify + persistência:
 *
 *   validate → createJob(queued) → setRunning → call(actor) → readDataset
 *   → mapper(items) → upsert(leads) → setSucceeded
 *
 * Em qualquer falha, marca o job `failed` com `error_message` e relança.
 * O caller decide se quer mostrar erro amigável ao user.
 */
export async function runAndPersist<TItem = unknown>(
  args: RunAndPersistInput<TItem>,
): Promise<RunAndPersistResult> {
  const { supabase, userId, source, actorId, input, mapper, onConflict } =
    args;

  const jobId = await createSearchJob({ supabase, userId, source, input });

  return executeSearchJob({
    supabase,
    userId,
    jobId,
    source,
    actorId,
    input,
    mapper,
    onConflict,
  });
}
