import { LeadsTable } from "@/components/leads/leads-table";
import { listLeads } from "@/lib/leads/list-leads";
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
  const { leads, totalCount, page, pageSize, totalPages } = await listLeads({
    supabase,
    params,
    filters,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Leads</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Sua base de leads captados, com filtros e tags.
        </p>
      </div>

      <LeadsTable
        leads={leads}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        sortBy={params.sortBy}
        sortDir={params.sortDir}
      />
    </div>
  );
}
