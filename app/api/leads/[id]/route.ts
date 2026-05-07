import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { apiErrorResponse } from "@/lib/api/errors";
import { deleteLead, getLead, updateLead } from "@/lib/leads/crud";
import { createServerSupabase } from "@/lib/supabase/server";
import { updateLeadSchema } from "@/lib/validators/leads";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function validationIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export async function GET(_request: Request, { params }: RouteContext) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const lead = await getLead({ supabase, id });
    if (!lead) {
      return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
    }
    return NextResponse.json(lead);
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "GET /api/leads/[id]", userId: user.id },
      "Falha ao carregar lead. Tente novamente.",
    );
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
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

  const parsed = updateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body inválido", issues: validationIssues(parsed.error) },
      { status: 400 },
    );
  }

  const { id } = await params;
  try {
    const lead = await updateLead({ supabase, id, input: parsed.data });
    if (!lead) {
      return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
    }
    return NextResponse.json(lead);
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "PATCH /api/leads/[id]", userId: user.id },
      "Falha ao atualizar lead. Tente novamente.",
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const ok = await deleteLead({ supabase, id });
    if (!ok) {
      return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "DELETE /api/leads/[id]", userId: user.id },
      "Falha ao excluir lead. Tente novamente.",
    );
  }
}
