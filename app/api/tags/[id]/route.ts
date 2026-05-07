import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { apiErrorResponse } from "@/lib/api/errors";
import {
  deleteTag,
  DuplicateTagError,
  updateTag,
} from "@/lib/leads/tags-crud";
import { createServerSupabase } from "@/lib/supabase/server";
import { updateTagSchema } from "@/lib/validators/tags";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function validationIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
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

  const parsed = updateTagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body inválido", issues: validationIssues(parsed.error) },
      { status: 400 },
    );
  }

  const { id } = await params;
  try {
    const tag = await updateTag({ supabase, id, input: parsed.data });
    if (!tag) {
      return NextResponse.json(
        { error: "Tag não encontrada" },
        { status: 404 },
      );
    }
    return NextResponse.json(tag);
  } catch (error) {
    if (error instanceof DuplicateTagError) {
      return NextResponse.json(
        { error: "Tag já existe com esse nome" },
        { status: 409 },
      );
    }
    return apiErrorResponse(
      error,
      { route: "PATCH /api/tags/[id]", userId: user.id },
      "Falha ao atualizar tag. Tente novamente.",
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
    const ok = await deleteTag({ supabase, id });
    if (!ok) {
      return NextResponse.json(
        { error: "Tag não encontrada" },
        { status: 404 },
      );
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "DELETE /api/tags/[id]", userId: user.id },
      "Falha ao excluir tag. Tente novamente.",
    );
  }
}
