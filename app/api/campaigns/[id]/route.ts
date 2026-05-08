import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { apiErrorResponse } from "@/lib/api/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { updateCampaignSchema } from "@/lib/validators/campaigns";

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
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select(
        "id, name, mode, template_text, ai_channel, ai_tone, ai_goal, status, total_count, sent_count, failed_count, started_at, completed_at, created_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!campaign) {
      return NextResponse.json(
        { error: "Campanha não encontrada" },
        { status: 404 },
      );
    }

    const { data: targets, error: tErr } = await supabase
      .from("campaign_targets")
      .select("lead_id, status, error_message, sent_message_id, created_at")
      .eq("campaign_id", id)
      .order("created_at", { ascending: true });
    if (tErr) throw tErr;

    return NextResponse.json({ campaign, targets: targets ?? [] });
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "GET /api/campaigns/[id]", userId: user.id },
      "Falha ao carregar campanha.",
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
      { error: "Body inválido", issues: [{ path: "", message: "JSON inválido" }] },
      { status: 400 },
    );
  }
  const parsed = updateCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body inválido", issues: validationIssues(parsed.error) },
      { status: 400 },
    );
  }

  const { id } = await params;
  try {
    if (parsed.data.action === "cancel") {
      const { data, error } = await supabase
        .from("campaigns")
        .update({
          status: "cancelled",
          completed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("id, status")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return NextResponse.json(
          { error: "Campanha não encontrada" },
          { status: 404 },
        );
      }
      return NextResponse.json({ campaign: data });
    }
    return NextResponse.json({ error: "Ação não suportada" }, { status: 400 });
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "PATCH /api/campaigns/[id]", userId: user.id },
      "Falha ao atualizar campanha.",
    );
  }
}
