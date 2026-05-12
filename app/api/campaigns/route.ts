import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { apiErrorResponse } from "@/lib/api/errors";
import { enqueueCampaign } from "@/lib/queue/campaigns";
import { env } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { createCampaignSchema } from "@/lib/validators/campaigns";

// #122: rota agora apenas enfileira em BullMQ. Processamento real acontece
// no worker (`lib/queue/worker.ts`) — `maxDuration` baixo basta porque o
// caminho crítico aqui é "INSERT campaign + INSERT targets + enqueue".
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const ONE_HOUR_MS = 3_600_000;

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
    // Rate-limit por usuário (#134). Duas defesas antes de qualquer escrita:
    //   1) Uma única campanha 'running' por user de cada vez — evita
    //      concorrência no processor (Anthropic + Evolution) e impede que
    //      o user dispare batches sobrepostos. Casa com #122 (BullMQ): o
    //      limite continua válido quando processCampaign migrar para fila.
    //   2) Hard cap de N campanhas criadas em uma janela de 1h (default 5
    //      via env.MAX_CAMPAIGNS_PER_HOUR). Protege budget Anthropic +
    //      quota WhatsApp contra flooding malicioso/acidental.
    const { count: runningCount } = await supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "running");
    if ((runningCount ?? 0) > 0) {
      return new Response(
        JSON.stringify({ error: "campaign_already_running" }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS).toISOString();
    const { count: hourCount } = await supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);
    if ((hourCount ?? 0) >= env.MAX_CAMPAIGNS_PER_HOUR) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: {
          "Retry-After": "60",
          "Content-Type": "application/json",
        },
      });
    }

    // Dedupe defensivo: payload `[lead, lead]` retornaria 1 row do Supabase
    // mas teria length=2 — rejeitaria campanha legítima (#129). Set garante
    // que validamos e processamos cada lead uma única vez, além de evitar
    // colisão na PK (campaign_id, lead_id) de `campaign_targets`.
    const leadIds = [...new Set(parsed.data.leadIds)];

    // Verifica que TODOS os leadIds pertencem ao user. RLS já filtra, mas
    // o `.eq('user_id', user.id)` é defesa em profundidade: caso a policy
    // seja alterada/desabilitada por engano, a query ainda nega acesso
    // cross-tenant (#129).
    const { data: validLeads } = await supabase
      .from("leads")
      .select("id")
      .in("id", leadIds)
      .eq("user_id", user.id);
    if (!validLeads || validLeads.length !== leadIds.length) {
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
        total_count: leadIds.length,
        // status='running' já no INSERT (#122): a campanha está "running" do
        // ponto de vista do usuário a partir do momento em que os jobs estão
        // na fila aguardando o worker. Antes de #122 isso ocorria dentro do
        // processor inline; agora é parte do contrato da rota.
        status: "running",
        started_at: new Date().toISOString(),
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

    const targetsPayload = leadIds.map((leadId) => ({
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

    // Enfileira N jobs (1 por target). Worker dedicado consome respeitando
    // throttle anti-ban (#122). NÃO bloqueia a request.
    // `(campaign_id, lead_id)` é a PK composta — sem coluna `id` sintética.
    const { queuedTargets } = await enqueueCampaign({
      campaignId: created.id,
      userId: user.id,
      targets: leadIds.map((leadId) => ({ leadId })),
    });

    return NextResponse.json(
      { campaignId: created.id, queuedTargets },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "POST /api/campaigns", userId: user.id },
      "Falha ao iniciar campanha.",
    );
  }
}
