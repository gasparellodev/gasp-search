import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import { generateMessage, type LeadForMessage } from "@/lib/ai/anthropic";
import { sendWhatsAppMessage } from "@/lib/evolution/send";
import { renderTemplate } from "@/lib/evolution/templates";
import {
  dispatchSitePreview,
  type DispatchSitePreviewResult,
} from "@/lib/sites/dispatch-site-preview";
import { createServiceSupabase } from "@/lib/supabase/service";
import type { AiMessageChannel, AiMessageTone } from "@/lib/validators/ai";
import type { CampaignTargetJob } from "@/lib/queue/campaigns";
import type { Database } from "@/types/database";

// ----------------------------------------------------------------------------
// processCampaignTarget — função pura-ish que processa UM único target da
// campanha. Substituiu o loop inline de `processCampaign(...)` em #122 quando
// migramos para fila BullMQ: cada `campaign_target` vira um job; este handler
// é chamado pelo worker (`lib/queue/worker.ts`) com 1 `CampaignTargetJob`.
//
// Trust boundary (security):
//   - Job é produzido por `POST /api/campaigns` após `auth.getUser()` +
//     validação de ownership dos leads. `userId` no job é confiável.
//   - Worker roda fora de request HTTP — não há cookies de sessão. Por isso
//     usa service_role do Supabase, com filtros explícitos por `user_id`
//     onde aplicável (mesmo padrão do webhook `/api/whatsapp/webhook`).
//   - `leadId` no job foi inserido em `campaign_targets` pela rota — o
//     `campaign_id` FK garante que pertence à mesma user_id da campanha.
//
// Branch routing (preservado de #172):
//   - `campaign.type === 'site_preview'` → `dispatchSitePreview` por lead.
//   - default ('message') → render template ou IA → `sendWhatsAppMessage`.
//
// Throttle: removido do loop. BullMQ Worker (`limiter: max=1 duration=3000`)
// garante 1 msg/3s entre jobs por instância — reusa `EVOLUTION_DEFAULT_THROTTLE_MS`.
// ----------------------------------------------------------------------------

export type ProcessTargetResult = {
  status: "sent" | "failed" | "skipped" | "cancelled";
};

export type ProcessTargetOptions = {
  /**
   * Service-role Supabase (bypassa RLS). Em produção: lazy-construído via
   * `createServiceSupabase()`. Em testes: mock injetado.
   */
  serviceClient?: SupabaseClient<Database>;
  sendImpl?: typeof sendWhatsAppMessage;
  generateMessageImpl?: typeof generateMessage;
  dispatchSitePreviewImpl?: typeof dispatchSitePreview;
};

type CampaignRow = {
  id: string;
  status: string;
  type: "message" | "site_preview";
  mode: "template" | "ai_per_lead";
  template_text: string | null;
  ai_channel: AiMessageChannel | null;
  ai_tone: AiMessageTone | null;
  ai_goal: string | null;
};

type LeadRow = LeadForMessage & { id: string };

export async function processCampaignTarget(
  job: CampaignTargetJob,
  opts: ProcessTargetOptions = {},
): Promise<ProcessTargetResult> {
  const supabase = opts.serviceClient ?? createServiceSupabase();
  const sendImpl = opts.sendImpl ?? sendWhatsAppMessage;
  const generateMessageImpl = opts.generateMessageImpl ?? generateMessage;
  const dispatchSitePreviewImpl =
    opts.dispatchSitePreviewImpl ?? dispatchSitePreview;

  // Defesa em profundidade (service-role bypassa RLS): filtra também por
  // `user_id` do job. Se a `campaign.user_id` divergir do `job.userId` por
  // qualquer motivo (corrupção do payload, bug futuro no enqueue, etc.), a
  // query retorna null e o processor aborta sem tocar em nada.
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, status, type, mode, template_text, ai_channel, ai_tone, ai_goal")
    .eq("id", job.campaignId)
    .eq("user_id", job.userId)
    .maybeSingle<CampaignRow>();

  if (!campaign) return { status: "skipped" };
  if (campaign.status === "cancelled") return { status: "cancelled" };

  const targetResult =
    campaign.type === "site_preview"
      ? await processSitePreviewBranch({
          supabase,
          campaign,
          job,
          sendImpl,
          dispatchSitePreviewImpl,
        })
      : await processMessageBranch({
          supabase,
          campaign,
          job,
          sendImpl,
          generateMessageImpl,
        });

  if (targetResult.status === "sent") {
    await incrementCounter(supabase, job.campaignId, "sent_count");
  } else if (targetResult.status === "failed") {
    await incrementCounter(supabase, job.campaignId, "failed_count");
  }

  await maybeMarkCompleted(supabase, job.campaignId);
  return targetResult;
}

// ----------------------------------------------------------------------------
// Branch 'message' (Phase 5/6) — render template ou gerar IA + send.
// ----------------------------------------------------------------------------

type MessageBranchArgs = {
  supabase: SupabaseClient<Database>;
  campaign: CampaignRow;
  job: CampaignTargetJob;
  sendImpl: typeof sendWhatsAppMessage;
  generateMessageImpl: typeof generateMessage;
};

async function processMessageBranch({
  supabase,
  campaign,
  job,
  sendImpl,
  generateMessageImpl,
}: MessageBranchArgs): Promise<ProcessTargetResult> {
  const { data: lead } = await supabase
    .from("leads")
    .select(
      "id, name, source, category, city, state, country, phone, email, website, instagram_handle, whatsapp, has_website, rating, reviews_count, followers_count, stage, score, notes",
    )
    .eq("id", job.leadId)
    .maybeSingle<LeadRow>();

  if (!lead) {
    await supabase
      .from("campaign_targets")
      .update({ status: "skipped", error_message: "lead removido" })
      .eq("campaign_id", job.campaignId)
      .eq("lead_id", job.leadId);
    return { status: "skipped" };
  }

  let content: string;
  try {
    if (campaign.mode === "template") {
      content = renderTemplate(campaign.template_text ?? "", lead);
    } else {
      content = await generateMessageImpl(lead, {
        channel: campaign.ai_channel ?? "whatsapp",
        tone: campaign.ai_tone ?? "consultivo",
        goal: campaign.ai_goal ?? "iniciar uma conversa comercial",
      });
    }
  } catch (err) {
    await supabase
      .from("campaign_targets")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message : "render/generate falhou",
      })
      .eq("campaign_id", job.campaignId)
      .eq("lead_id", job.leadId);
    return { status: "failed" };
  }

  const result = await sendImpl({
    supabase,
    userId: job.userId,
    leadId: job.leadId,
    content,
    campaignId: job.campaignId,
    aiGenerated: campaign.mode === "ai_per_lead",
  });

  if (result.ok) {
    await supabase
      .from("campaign_targets")
      .update({
        status: "sent",
        sent_message_id: result.messageId,
      })
      .eq("campaign_id", job.campaignId)
      .eq("lead_id", job.leadId);
    return { status: "sent" };
  }

  await supabase
    .from("campaign_targets")
    .update({
      status: "failed",
      error_message: result.error ?? result.reason,
    })
    .eq("campaign_id", job.campaignId)
    .eq("lead_id", job.leadId);
  return { status: "failed" };
}

// ----------------------------------------------------------------------------
// Branch 'site_preview' (#172) — dispatchSitePreview per lead.
// ----------------------------------------------------------------------------

type SitePreviewBranchArgs = {
  supabase: SupabaseClient<Database>;
  campaign: CampaignRow;
  job: CampaignTargetJob;
  sendImpl: typeof sendWhatsAppMessage;
  dispatchSitePreviewImpl: typeof dispatchSitePreview;
};

async function processSitePreviewBranch({
  supabase,
  job,
  sendImpl,
  dispatchSitePreviewImpl,
}: SitePreviewBranchArgs): Promise<ProcessTargetResult> {
  // Worker roda fora de request — usa o mesmo service-role para o helper
  // tanto na leitura (lead_sites, leads) quanto na escrita (lead_sites.sent).
  // Trust boundary: `userId` e `leadId` vêm do job, ambos validados na rota.
  const service = supabase;

  let outcome: DispatchSitePreviewResult;
  try {
    outcome = await dispatchSitePreviewImpl({
      supabase,
      service,
      userId: job.userId,
      leadId: job.leadId,
      sendImpl,
    });
  } catch (err) {
    outcome = {
      ok: false,
      reason: "db_error",
      message:
        err instanceof Error ? err.message : "dispatch falhou inesperadamente",
    };
  }

  if (outcome.ok) {
    await supabase
      .from("campaign_targets")
      .update({ status: "sent" })
      .eq("campaign_id", job.campaignId)
      .eq("lead_id", job.leadId);
    return { status: "sent" };
  }

  if (outcome.reason === "no_site" || outcome.reason === "invalid_status") {
    await supabase
      .from("campaign_targets")
      .update({
        status: "skipped",
        error_message: `${outcome.reason}: ${outcome.message}`,
      })
      .eq("campaign_id", job.campaignId)
      .eq("lead_id", job.leadId);
    return { status: "skipped" };
  }

  // 'whatsapp_error' | 'render_error' | 'db_error' | 'rate_limit_daily' →
  // failed (incl. rate_limit_daily — decisão #173 explícita).
  await supabase
    .from("campaign_targets")
    .update({
      status: "failed",
      error_message: `${outcome.reason}: ${outcome.message}`,
    })
    .eq("campaign_id", job.campaignId)
    .eq("lead_id", job.leadId);
  return { status: "failed" };
}

// ----------------------------------------------------------------------------
// Counter increment — preservado de Phase 5. Sequência read+update mantém
// shape simples; race conditions são aceitáveis pois counters são "eventually
// consistent" (UI lê o último estado). BullMQ com concurrency=1 + limiter
// efetivamente serializa as escritas por queue (= por instância).
// ----------------------------------------------------------------------------

async function incrementCounter(
  supabase: SupabaseClient<Database>,
  campaignId: string,
  column: "sent_count" | "failed_count",
): Promise<void> {
  const { data } = await supabase
    .from("campaigns")
    .select("sent_count, failed_count")
    .eq("id", campaignId)
    .maybeSingle<{ sent_count: number; failed_count: number }>();
  if (!data) return;
  const current = data[column] ?? 0;
  if (column === "sent_count") {
    await supabase
      .from("campaigns")
      .update({ sent_count: current + 1 })
      .eq("id", campaignId);
  } else {
    await supabase
      .from("campaigns")
      .update({ failed_count: current + 1 })
      .eq("id", campaignId);
  }
}

// ----------------------------------------------------------------------------
// Completion detection — depois de processar 1 target, conta quantos ainda
// estão `pending`. Se 0, é o último: marca `completed`. Se a campanha foi
// cancelada mid-job, o final-status check evita sobrescrever 'cancelled'.
// ----------------------------------------------------------------------------

async function maybeMarkCompleted(
  supabase: SupabaseClient<Database>,
  campaignId: string,
): Promise<void> {
  const { count } = await supabase
    .from("campaign_targets")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  if ((count ?? 0) > 0) return;

  const { data: finalStatus } = await supabase
    .from("campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle<{ status: string }>();

  if (finalStatus?.status === "cancelled") return;

  await supabase
    .from("campaigns")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
}
