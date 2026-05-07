import { FiltersBar } from "@/components/leads/filters-bar";
import { LeadsTable } from "@/components/leads/leads-table";
import { listLeads } from "@/lib/leads/list-leads";
import { listTags } from "@/lib/leads/list-tags";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseLeadsListInput } from "@/lib/validators/leads";

export const metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

interface LeadsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const raw = await searchParams;
  const { params, filters } = parseLeadsListInput(raw);
  const supabase = await createServerSupabase();

  const [leadsResult, tags] = await Promise.all([
    listLeads({ supabase, params, filters }),
    listTags({ supabase }),
  ]);
  const { leads, totalCount, page, pageSize, totalPages } = leadsResult;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-6">
      <div className="shrink-0">
        <h1 className="text-3xl font-semibold tracking-tight">Leads</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Sua base de leads captados, com filtros e tags.
        </p>
      </div>

      <div className="shrink-0">
        <FiltersBar tags={tags} filters={filters} />
      </div>

      <div className="min-h-0 flex-1">
        <LeadsTable
          leads={leads}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          sortBy={params.sortBy}
          sortDir={params.sortDir}
          tags={tags}
        />
      </div>
    </div>
  );
}
