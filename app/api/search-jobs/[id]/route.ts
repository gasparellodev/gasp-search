import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { data: job, error } = await supabase
      .from("search_jobs")
      .select("id, status, results_count, error_message, created_at, finished_at")
      .eq("id", id)
      .single();

    if (error || !job) {
      return NextResponse.json(
        { error: "Job não encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json(job);
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "GET /api/search-jobs/[id]", userId: user.id },
      "Falha ao carregar status da busca. Tente novamente.",
    );
  }
}
