import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { apiErrorResponse } from "@/lib/api/errors";
import { listTags } from "@/lib/leads/list-tags";
import { createTag, DuplicateTagError } from "@/lib/leads/tags-crud";
import { createServerSupabase } from "@/lib/supabase/server";
import { createTagSchema } from "@/lib/validators/tags";

function validationIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const tags = await listTags({ supabase });
    return NextResponse.json({ data: tags });
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "GET /api/tags", userId: user.id },
      "Falha ao listar tags. Tente novamente.",
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

  const parsed = createTagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body inválido", issues: validationIssues(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const tag = await createTag({
      supabase,
      userId: user.id,
      input: parsed.data,
    });
    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateTagError) {
      return NextResponse.json(
        { error: "Tag já existe com esse nome" },
        { status: 409 },
      );
    }
    return apiErrorResponse(
      error,
      { route: "POST /api/tags", userId: user.id },
      "Falha ao criar tag. Tente novamente.",
    );
  }
}
