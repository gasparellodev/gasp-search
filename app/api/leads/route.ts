import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { createLead } from "@/lib/leads/crud";
import { listLeads } from "@/lib/leads/list-leads";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  createLeadSchema,
  parseLeadsListInput,
} from "@/lib/validators/leads";

function validationIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
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
    const { leads, totalCount, page, pageSize, totalPages } = await listLeads({
      supabase,
      params,
      filters,
    });
    return NextResponse.json({
      data: leads,
      total: totalCount,
      page,
      pageSize,
      totalPages,
    });
  } catch {
    return NextResponse.json(
      { error: "Falha ao listar leads. Tente novamente." },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      {
        error: "Body inválido",
        issues: [{ path: "", message: "JSON inválido" }],
      },
      { status: 400 },
    );
  }

  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body inválido", issues: validationIssues(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const lead = await createLead({
      supabase,
      userId: user.id,
      input: parsed.data,
    });
    return NextResponse.json(lead, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Falha ao criar lead. Tente novamente." },
      { status: 502 },
    );
  }
}
