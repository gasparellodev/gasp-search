import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { LeadTagSummary } from "@/lib/leads/list-leads";

export async function listTags({
  supabase,
}: {
  supabase: SupabaseClient<Database>;
}): Promise<LeadTagSummary[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, color")
    .order("name", { ascending: true });

  if (error) throw new Error(`Falha ao listar tags: ${error.message}`);
  return (data ?? []) as LeadTagSummary[];
}
