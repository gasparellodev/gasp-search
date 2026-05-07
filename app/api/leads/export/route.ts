import { NextResponse } from "next/server";
import {
  listLeads,
  type LeadListItem,
} from "@/lib/leads/list-leads";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  parseLeadsListInput,
  type LeadPageSize,
} from "@/lib/validators/leads";

const CSV_BOM = "\uFEFF";
const EXPORT_PAGE_SIZE = 100 satisfies LeadPageSize;

type CsvColumn = {
  header: string;
  value: (lead: LeadListItem) => string | number | boolean | null | undefined;
};
type CsvValue = ReturnType<CsvColumn["value"]>;

const CSV_COLUMNS: CsvColumn[] = [
  { header: "Nome", value: (lead) => lead.name },
  { header: "Categoria", value: (lead) => lead.category },
  { header: "Cidade", value: (lead) => lead.city },
  { header: "Estado", value: (lead) => lead.state },
  { header: "Telefone", value: (lead) => lead.phone },
  { header: "E-mail", value: (lead) => lead.email },
  { header: "Website", value: (lead) => lead.website },
  { header: "Instagram", value: (lead) => lead.instagram_handle },
  { header: "WhatsApp", value: (lead) => lead.whatsapp },
  {
    header: "Tem site",
    value: (lead) =>
      lead.has_website === null ? null : lead.has_website ? "Sim" : "Não",
  },
  { header: "Avaliação", value: (lead) => lead.rating },
  { header: "Reviews", value: (lead) => lead.reviews_count },
  { header: "Seguidores", value: (lead) => lead.followers_count },
  { header: "Estágio", value: (lead) => lead.stage },
  { header: "Score", value: (lead) => lead.score },
  { header: "Fonte", value: (lead) => lead.source },
  {
    header: "Tags",
    value: (lead) => lead.tags.map((tag) => tag.name).join("; "),
  },
  { header: "Notas", value: (lead) => lead.notes },
  { header: "Criado em", value: (lead) => lead.created_at },
];

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function serializeLeadsCsv(leads: LeadListItem[]): string {
  const header = CSV_COLUMNS.map((column) => escapeCsvValue(column.header));
  const rows = leads.map((lead) =>
    CSV_COLUMNS.map((column) => escapeCsvValue(column.value(lead))).join(","),
  );
  return `${CSV_BOM}${[header.join(","), ...rows].join("\r\n")}\r\n`;
}

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const { params, filters } = parseLeadsListInput(url.searchParams);

  try {
    const allLeads: LeadListItem[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const result = await listLeads({
        supabase,
        params: {
          ...params,
          page,
          pageSize: EXPORT_PAGE_SIZE,
        },
        filters,
      });
      allLeads.push(...result.leads);
      totalPages = result.totalPages;
      page += 1;
    } while (page <= totalPages);

    return new Response(serializeLeadsCsv(allLeads), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="leads-export.csv"',
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Falha ao exportar leads. Tente novamente." },
      { status: 502 },
    );
  }
}
