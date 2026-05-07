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

  // 1. Cria search_job (queued).
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

  const jobId = createdJob.id as string;

  try {
    // 2. running
    await supabase
      .from("search_jobs")
      .update({ status: "running" })
      .eq("id", jobId);

    // 3. call actor (síncrono).
    const apify = getApify();
    const run = await apify.actor(actorId).call(input);

    // 4. read dataset
    const { items } = await apify
      .dataset(run.defaultDatasetId)
      .listItems();

    // 5. map → upsert
    const leads: LeadInsert[] = [];
    for (const item of items as TItem[]) {
      const mapped = mapper(item, { userId, jobId, source });
      if (mapped) leads.push(mapped);
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

    // 6. succeeded
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
