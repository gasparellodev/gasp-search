import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { enrichLeadsByUrls } from "@/lib/apify/enrich";
import { createServerSupabase } from "@/lib/supabase/server";
import { enrichRequestSchema } from "@/lib/validators/search";

export const maxDuration = 300;

function validationIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
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

  const parsed = enrichRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body inválido", issues: validationIssues(parsed.error) },
      { status: 400 },
    );
  }

  // RLS já filtra por user_id; só leads do user logado são retornados.
  const { data: leads, error: fetchError } = await supabase
    .from("leads")
    .select("id, website")
    .in("id", parsed.data.leadIds);

  if (fetchError) {
    return NextResponse.json(
      { error: "Falha ao carregar leads. Tente novamente." },
      { status: 502 },
    );
  }

  const leadRows = (leads ?? []) as Array<{
    id: string;
    website: string | null;
  }>;
  if (leadRows.length === 0) {
    return NextResponse.json(
      { error: "Nenhum lead encontrado" },
      { status: 404 },
    );
  }

  const withWebsite = leadRows.filter(
    (row): row is { id: string; website: string } => row.website !== null,
  );
  const urls = withWebsite.map((row) => row.website);

  const idsWithoutWebsite = leadRows
    .filter((row) => row.website === null)
    .map((row) => row.id);

  if (urls.length === 0) {
    return NextResponse.json({
      enrichedCount: 0,
      failedIds: leadRows.map((row) => row.id),
    });
  }

  try {
    const result = await enrichLeadsByUrls({
      supabase,
      userId: user.id,
      urls,
    });

    const enrichedSet = new Set(result.enrichedLeadIds);
    const failedIds = [
      ...idsWithoutWebsite,
      ...withWebsite
        .filter((row) => !enrichedSet.has(row.id))
        .map((row) => row.id),
    ];

    return NextResponse.json({
      enrichedCount: result.enrichedCount,
      failedIds,
    });
  } catch {
    return NextResponse.json(
      { error: "Falha ao executar enrich. Tente novamente." },
      { status: 502 },
    );
  }
}
