import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { apiErrorResponse } from "@/lib/api/errors";
import { processCampaign } from "@/lib/campaigns/processor";
import { createServerSupabase } from "@/lib/supabase/server";
import { createCampaignSchema } from "@/lib/validators/campaigns";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

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
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
  try {
    const { data, error } = await supabase
      .from("campaigns")
      .select(
        "id, name, mode, status, total_count, sent_count, failed_count, started_at, completed_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return NextResponse.json({ campaigns: data ?? [] });
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "GET /api/campaigns", userId: user.id },
      "Falha ao listar campanhas.",
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
      { error: "Body inválido", issues: [{ path: "", message: "JSON inválido" }] },
      { status: 400 },
    );
  }

  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body inválido", issues: validationIssues(parsed.error) },
      { status: 400 },
    );
  }

  try {
    // Verifica que TODOS os leadIds pertencem ao user — RLS garante,
    // mas validamos explicitamente pra retornar mensagem amigável.
    const { data: validLeads } = await supabase
      .from("leads")
      .select("id")
      .in("id", parsed.data.leadIds);
    if (!validLeads || validLeads.length !== parsed.data.leadIds.length) {
      return NextResponse.json(
        { error: "Alguns leads não foram encontrados ou não pertencem a você." },
        { status: 422 },
      );
    }

    const { data: created, error: insertError } = await supabase
      .from("campaigns")
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        mode: parsed.data.mode,
        template_text: parsed.data.templateText ?? null,
        ai_channel: parsed.data.aiChannel ?? null,
        ai_tone: parsed.data.aiTone ?? null,
        ai_goal: parsed.data.aiGoal ?? null,
        total_count: parsed.data.leadIds.length,
        status: "draft",
      })
      .select("id")
      .single();
    if (insertError || !created) {
      return apiErrorResponse(
        insertError ?? new Error("insert failed"),
        { route: "POST /api/campaigns", userId: user.id },
        "Falha ao criar campanha.",
      );
    }

    const targetsPayload = parsed.data.leadIds.map((leadId) => ({
      campaign_id: created.id,
      lead_id: leadId,
      status: "pending" as const,
    }));
    const { error: targetsError } = await supabase
      .from("campaign_targets")
      .insert(targetsPayload);
    if (targetsError) {
      return apiErrorResponse(
        targetsError,
        { route: "POST /api/campaigns", userId: user.id },
        "Falha ao criar targets da campanha.",
      );
    }

    // Processor inline (mesma request, com maxDuration=300 acomodando até 50 leads * ~3s).
    await processCampaign({
      supabase,
      userId: user.id,
      campaignId: created.id,
    });

    return NextResponse.json({ campaignId: created.id }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "POST /api/campaigns", userId: user.id },
      "Falha ao iniciar campanha.",
    );
  }
}
