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
  const { tagIds: _tagIds, ...rest } = input;
  void _tagIds; // Tags via endpoint dedicado (#22) — não atualizadas aqui.

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
