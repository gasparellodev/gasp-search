import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import type {
  LeadPageSize,
  LeadsListParams,
} from "@/lib/validators/leads";

export type LeadTagSummary = {
  id: string;
  name: string;
  color: string;
};

export type LeadListItem = Tables<"leads"> & {
  tags: LeadTagSummary[];
};

export type ListLeadsResult = {
  leads: LeadListItem[];
  totalCount: number;
  page: number;
  pageSize: LeadPageSize;
  totalPages: number;
};

const LEAD_SELECT =
  "*, lead_tags(tag:tags(id, name, color))";

type LeadRow = Tables<"leads"> & {
  lead_tags:
    | Array<{ tag: LeadTagSummary | null }>
    | null;
};

function flattenTags(row: LeadRow): LeadTagSummary[] {
  if (!row.lead_tags) return [];
  const tags: LeadTagSummary[] = [];
  for (const link of row.lead_tags) {
    if (link.tag) tags.push(link.tag);
  }
  return tags;
}

export async function listLeads({
  supabase,
  params,
}: {
  supabase: SupabaseClient<Database>;
  params: LeadsListParams;
}): Promise<ListLeadsResult> {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  const { data, count, error } = await supabase
    .from("leads")
    .select(LEAD_SELECT, { count: "exact" })
    .order(params.sortBy, { ascending: params.sortDir === "asc" })
    .range(from, to);

  if (error) {
    throw new Error(`Falha ao listar leads: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as LeadRow[];
  const totalCount = count ?? 0;
  const totalPages =
    totalCount === 0 ? 0 : Math.ceil(totalCount / params.pageSize);

  const leads: LeadListItem[] = rows.map((row) => {
    const { lead_tags: _omit, ...rest } = row;
    void _omit;
    return {
      ...(rest as Tables<"leads">),
      tags: flattenTags(row),
    };
  });

  return {
    leads,
    totalCount,
    page: params.page,
    pageSize: params.pageSize,
    totalPages,
  };
}
