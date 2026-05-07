import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { enrichLeadsByUrls } from "@/lib/apify/enrich";

export interface AutoEnrichResult {
  enrichedCount: number;
  enrichedLeadIds: string[];
  /**
   * Mensagem de erro **não-fatal**. O hook nunca lança — falhas são
   * registradas aqui para o caller decidir se loga ou ignora.
   */
  error?: string;
}

/**
 * Após uma busca Google Maps, encontra leads recém-criados com `website`
 * mas sem `email` e dispara enrich em background.
 *
 * **Importante**: nunca lança. A busca original já completou; uma falha de
 * enrich não deve afetar a resposta para o user.
 */
export async function autoEnrichGoogleMapsJob({
  supabase,
  userId,
  jobId,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  jobId: string;
}): Promise<AutoEnrichResult> {
  try {
    const { data, error } = await supabase
      .from("leads")
      .select("id, website, email")
      .eq("source_search_job_id", jobId)
      .eq("source", "google_maps");

    if (error) {
      return { enrichedCount: 0, enrichedLeadIds: [], error: error.message };
    }

    const candidates = (data ?? []) as Array<{
      id: string;
      website: string | null;
      email: string | null;
    }>;

    const urls = candidates
      .filter((row) => row.website !== null && row.email === null)
      .map((row) => row.website as string);

    if (urls.length === 0) {
      return { enrichedCount: 0, enrichedLeadIds: [] };
    }

    const result = await enrichLeadsByUrls({ supabase, userId, urls });
    return {
      enrichedCount: result.enrichedCount,
      enrichedLeadIds: result.enrichedLeadIds,
    };
  } catch (error) {
    return {
      enrichedCount: 0,
      enrichedLeadIds: [],
      error: error instanceof Error ? error.message : "desconhecido",
    };
  }
}
