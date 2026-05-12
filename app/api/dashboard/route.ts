import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import {
  getFunnelStats,
  getSourceBreakdown,
} from "@/lib/dashboard/insights";
import { getDashboardSummary } from "@/lib/dashboard/summary";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const [summary, sourceBreakdown, funnel] = await Promise.all([
      getDashboardSummary({ supabase }),
      getSourceBreakdown({ supabase }),
      getFunnelStats({ supabase }),
    ]);
    return NextResponse.json(
      { ...summary, sourceBreakdown, funnel },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "GET /api/dashboard", userId: user.id },
      "Falha ao carregar dashboard. Tente novamente.",
    );
  }
}
