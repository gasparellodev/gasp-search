import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import type {
  LeadFilters,
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
  filters,
}: {
  supabase: SupabaseClient<Database>;
  params: LeadsListParams;
  filters?: LeadFilters;
}): Promise<ListLeadsResult> {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  // Resolver tagIds via subquery (Supabase nested filter em junção é
  // limitado; mais simples e testável fazer em duas etapas).
  let leadIdsFromTags: string[] | null = null;
  if (filters?.tagIds && filters.tagIds.length > 0) {
    const { data: junctionRows, error: tagError } = await supabase
      .from("lead_tags")
      .select("lead_id")
      .in("tag_id", filters.tagIds);
    if (tagError) {
      throw new Error(`Falha ao listar leads: ${tagError.message}`);
    }
    leadIdsFromTags = (junctionRows ?? []).map(
      (row) => (row as { lead_id: string }).lead_id,
    );
    if (leadIdsFromTags.length === 0) {
      return {
        leads: [],
        totalCount: 0,
        page: params.page,
        pageSize: params.pageSize,
        totalPages: 0,
      };
    }
  }

  type Builder = {
    eq: (column: string, value: unknown) => Builder;
    ilike: (column: string, value: string) => Builder;
    in: (column: string, values: unknown[]) => Builder;
    order: (
      column: string,
      opts: { ascending: boolean },
    ) => { range: (from: number, to: number) => Promise<unknown> };
  };

  let query = supabase
    .from("leads")
    .select(LEAD_SELECT, { count: "exact" }) as unknown as Builder;

  if (filters?.stage) query = query.eq("stage", filters.stage);
  if (filters?.source) query = query.eq("source", filters.source);
  if (filters?.hasWebsite !== undefined) {
    query = query.eq("has_website", filters.hasWebsite);
  }
  if (filters?.q) query = query.ilike("name", `%${filters.q}%`);
  if (leadIdsFromTags) query = query.in("id", leadIdsFromTags);

  const { data, count, error } = (await query
    .order(params.sortBy, { ascending: params.sortDir === "asc" })
    .range(from, to)) as {
    data: unknown;
    count: number | null;
    error: { message: string } | null;
  };

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
