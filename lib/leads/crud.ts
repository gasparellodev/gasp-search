import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import type {
  CreateLeadInput,
  UpdateLeadInput,
} from "@/lib/validators/leads";
import type { LeadListItem, LeadTagSummary } from "@/lib/leads/list-leads";

const LEAD_SELECT = "*, lead_tags(tag:tags(id, name, color))";

type LeadRow = Tables<"leads"> & {
  lead_tags:
    | Array<{ tag: LeadTagSummary | null }>
    | null;
};

function flattenRow(row: LeadRow): LeadListItem {
  const tags: LeadTagSummary[] = [];
  for (const link of row.lead_tags ?? []) {
    if (link.tag) tags.push(link.tag);
  }
  const { lead_tags: _omit, ...rest } = row;
  void _omit;
  return {
    ...(rest as Tables<"leads">),
    tags,
  };
}

export async function getLead({
  supabase,
  id,
}: {
  supabase: SupabaseClient<Database>;
  id: string;
}): Promise<LeadListItem | null> {
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar lead: ${error.message}`);
  if (!data) return null;
  return flattenRow(data as unknown as LeadRow);
}

export async function createLead({
  supabase,
  userId,
  input,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  input: CreateLeadInput;
}): Promise<LeadListItem> {
  const { tagIds: _tagIds, ...rest } = input;
  void _tagIds; // Tags são geridos por endpoint dedicado em #22.
  const payload = {
    ...rest,
    user_id: userId,
  };

  const { data, error } = await supabase
    .from("leads")
    .insert(payload)
    .select(LEAD_SELECT)
    .single();

  if (error || !data) {
    throw new Error(`Falha ao criar lead: ${error?.message ?? "desconhecido"}`);
  }
  return flattenRow(data as unknown as LeadRow);
}

export async function updateLead({
  supabase,
  id,
  input,
}: {
  supabase: SupabaseClient<Database>;
  id: string;
  input: UpdateLeadInput;
}): Promise<LeadListItem | null> {
  const { tagIds, ...rest } = input;

  // Caminho rápido: sem tagIds, faz o update e devolve o select-after-update.
  if (tagIds === undefined) {
    const { data, error } = await supabase
      .from("leads")
      .update(rest)
      .eq("id", id)
      .select(LEAD_SELECT)
      .maybeSingle();
    if (error) throw new Error(`Falha ao atualizar lead: ${error.message}`);
    if (!data) return null;
    return flattenRow(data as unknown as LeadRow);
  }

  // Caminho com tagIds: atualiza colunas escalares (se houver), sincroniza
  // junção lead_tags, e re-lê para devolver o lead completo com tags fresh.
  if (Object.keys(rest).length > 0) {
    const { data, error } = await supabase
      .from("leads")
      .update(rest)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`Falha ao atualizar lead: ${error.message}`);
    if (!data) return null;
  } else {
    // RLS guard: garante que o lead pertence ao user antes de tocar a junção.
    const { data, error } = await supabase
      .from("leads")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Falha ao atualizar lead: ${error.message}`);
    if (!data) return null;
  }

  await syncLeadTags({ supabase, leadId: id, tagIds });
  return getLead({ supabase, id });
}

export async function syncLeadTags({
  supabase,
  leadId,
  tagIds,
}: {
  supabase: SupabaseClient<Database>;
  leadId: string;
  tagIds: string[];
}): Promise<void> {
  const { data, error } = await supabase
    .from("lead_tags")
    .select("tag_id")
    .eq("lead_id", leadId);
  if (error) throw new Error(`Falha ao sincronizar tags: ${error.message}`);

  const current = new Set(
    (data ?? []).map((row) => (row as { tag_id: string }).tag_id),
  );
  const target = new Set(tagIds);

  const toRemove = [...current].filter((id) => !target.has(id));
  const toAdd = [...target].filter((id) => !current.has(id));

  if (toRemove.length > 0) {
    const { error: delError } = await supabase
      .from("lead_tags")
      .delete()
      .eq("lead_id", leadId)
      .in("tag_id", toRemove);
    if (delError) {
      throw new Error(`Falha ao sincronizar tags: ${delError.message}`);
    }
  }

  if (toAdd.length > 0) {
    const { error: insError } = await supabase
      .from("lead_tags")
      .insert(toAdd.map((tagId) => ({ lead_id: leadId, tag_id: tagId })));
    if (insError) {
      throw new Error(`Falha ao sincronizar tags: ${insError.message}`);
    }
  }
}

export async function deleteLead({
  supabase,
  id,
}: {
  supabase: SupabaseClient<Database>;
  id: string;
}): Promise<boolean> {
  const { count, error } = (await supabase
    .from("leads")
    .delete({ count: "exact" })
    .eq("id", id)) as {
    count: number | null;
    error: { message: string } | null;
  };

  if (error) throw new Error(`Falha ao excluir lead: ${error.message}`);
  return (count ?? 0) > 0;
}
