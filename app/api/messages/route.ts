import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { listLeadMessages, LEAD_MESSAGES_PAGE_SIZE } from "@/lib/ai/messages";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const leadId = url.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json(
      { error: "leadId obrigatório" },
      { status: 400 },
    );
  }

  const pageRaw = url.searchParams.get("page");
  const page = pageRaw ? Number.parseInt(pageRaw, 10) : 1;

  try {
    // /messages é o chat real — não mostra rascunho de IA não enviado.
    const result = await listLeadMessages({
      supabase,
      leadId,
      page: Number.isFinite(page) ? page : 1,
      realOnly: true,
    });
    return NextResponse.json({
      messages: result.messages,
      page: result.page,
      pageSize: LEAD_MESSAGES_PAGE_SIZE,
      totalPages: result.totalPages,
      totalCount: result.totalCount,
    });
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "GET /api/messages", userId: user.id },
      "Falha ao carregar mensagens.",
    );
  }
}
