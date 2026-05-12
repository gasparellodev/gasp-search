import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { getLeadPresence } from "@/lib/whatsapp/presence";

interface RouteContext {
  params: Promise<{ leadId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { leadId } = await params;

  try {
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!lead) {
      return NextResponse.json(
        { error: "Lead não encontrado." },
        { status: 404 },
      );
    }

    const snapshot = await getLeadPresence({ userId: user.id, leadId });
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "GET /api/whatsapp/presence/[leadId]", userId: user.id },
      "Falha ao carregar presença.",
    );
  }
}
