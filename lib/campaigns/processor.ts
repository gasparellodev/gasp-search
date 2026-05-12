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
import type {
  AiMessageChannel,
  AiMessageTone,
} from "@/lib/validators/ai";
import type { Database } from "@/types/database";

// ----------------------------------------------------------------------------
// Processor inline de campanha. Loop pelos targets pendentes, com throttle
// configurável (default 3s). Checa cancelamento a cada iteração e atualiza
// counters em campaigns conforme processa.
//
// Branch dispatch (#172):
//   - `campaign.type === 'site_preview'` → flow dedicado que ignora
//     mode/template_text/ai_* e dispara `dispatchSitePreview` por lead.
//   - default ('message') → fluxo Phase 5 preservado.
// ----------------------------------------------------------------------------

export type ProcessOptions = {
  supabase: SupabaseClient<Database>;
  userId: string;
  campaignId: string;
  throttleMs?: number;
  // Permite injeção em testes sem depender de timer real.
  sleep?: (ms: number) => Promise<void>;
  sendImpl?: typeof sendWhatsAppMessage;
  generateMessageImpl?: typeof generateMessage;
  // Injeção pro branch site_preview — em testes evita supabase service_role
  // real e isola o helper de dispatch.
  dispatchSitePreviewImpl?: typeof dispatchSitePreview;
  serviceClient?: SupabaseClient<Database>;
};

const DEFAULT_THROTTLE_MS = 3_000;

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

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

export async function processCampaign({
  supabase,
  userId,
  campaignId,
  throttleMs = DEFAULT_THROTTLE_MS,
  sleep = defaultSleep,
  sendImpl = sendWhatsAppMessage,
  generateMessageImpl = generateMessage,
  dispatchSitePreviewImpl = dispatchSitePreview,
  serviceClient,
}: ProcessOptions): Promise<{ sent: number; failed: number }> {
  const { data: campaign } = await supabase
    .from("campaigns")
    .select(
      "id, status, type, mode, template_text, ai_channel, ai_tone, ai_goal",
    )
    .eq("id", campaignId)
    .maybeSingle<CampaignRow>();
  if (!campaign) return { sent: 0, failed: 0 };

  await supabase
    .from("campaigns")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", campaignId);

  const { data: targets } = await supabase
    .from("campaign_targets")
    .select("lead_id, status")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  let sent = 0;
  let failed = 0;
  const targetList = targets ?? [];

  // Branch dispatch — site_preview tem fluxo distinto (per-lead leadSite
  // fetch + render template hard-coded + sendWhatsAppMessage). Resto do
  // loop (cancel check + throttle + counters) é compartilhado.
  if (campaign.type === "site_preview") {
    // Service client é necessário pra escrever lead_sites.status='sent'
    // (RLS bloqueia o cliente authenticated em alguns ambientes). Em
    // testes, o caller injeta um mock; em prod, lazy-initializa.
    const service = serviceClient ?? createServiceSupabase();
    for (let i = 0; i < targetList.length; i++) {
      const target = targetList[i]!;
      // Verifica cancelamento mid-run.
      const { data: current } = await supabase
        .from("campaigns")
        .select("status")
        .eq("id", campaignId)
        .maybeSingle<{ status: string }>();
      if (current?.status === "cancelled") break;

      let outcome: DispatchSitePreviewResult;
      try {
        outcome = await dispatchSitePreviewImpl({
          supabase,
          service,
          userId,
          leadId: target.lead_id,
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
          .eq("campaign_id", campaignId)
          .eq("lead_id", target.lead_id);
        sent++;
        await incrementCounter(supabase, campaignId, "sent_count");
      } else if (
        outcome.reason === "no_site" ||
        outcome.reason === "invalid_status"
      ) {
        // Skip — lead não-elegível, não é erro de envio. Persiste reason
        // explícita pra UX da fila ("X leads pulados — sem site").
        await supabase
          .from("campaign_targets")
          .update({
            status: "skipped",
            error_message: `${outcome.reason}: ${outcome.message}`,
          })
          .eq("campaign_id", campaignId)
          .eq("lead_id", target.lead_id);
      } else {
        // Catch-all: 'whatsapp_error' | 'render_error' | 'db_error' |
        // 'rate_limit_daily' (#173). Todos viram 'failed' — operador
        // precisa de awareness. Em particular, `rate_limit_daily` é
        // intencionalmente 'failed' (não 'skipped') pra que a UI mostre
        // "campanha falhou em N leads — limite diário atingido". Se
        // fosse skipped, ficariam invisíveis na fila e o operador
        // dispararia outra campanha amanhã sem entender o gap.
        await supabase
          .from("campaign_targets")
          .update({
            status: "failed",
            error_message: `${outcome.reason}: ${outcome.message}`,
          })
          .eq("campaign_id", campaignId)
          .eq("lead_id", target.lead_id);
        failed++;
        await incrementCounter(supabase, campaignId, "failed_count");
      }

      if (i < targetList.length - 1) await sleep(throttleMs);
    }
  } else {
    // Default 'message' flow (Phase 5/6) — preservado intacto.
    for (let i = 0; i < targetList.length; i++) {
      const target = targetList[i]!;
      // Verifica cancelamento mid-run.
      const { data: current } = await supabase
        .from("campaigns")
        .select("status")
        .eq("id", campaignId)
        .maybeSingle<{ status: string }>();
      if (current?.status === "cancelled") break;

      const { data: lead } = await supabase
        .from("leads")
        .select(
          "id, name, source, category, city, state, country, phone, email, website, instagram_handle, whatsapp, has_website, rating, reviews_count, followers_count, stage, score, notes",
        )
        .eq("id", target.lead_id)
        .maybeSingle<LeadRow>();

      if (!lead) {
        await supabase
          .from("campaign_targets")
          .update({ status: "skipped", error_message: "lead removido" })
          .eq("campaign_id", campaignId)
          .eq("lead_id", target.lead_id);
        continue;
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
            error_message:
              err instanceof Error ? err.message : "render/generate falhou",
          })
          .eq("campaign_id", campaignId)
          .eq("lead_id", target.lead_id);
        failed++;
        await incrementCounter(supabase, campaignId, "failed_count");
        if (i < targetList.length - 1) await sleep(throttleMs);
        continue;
      }

      const result = await sendImpl({
        supabase,
        userId,
        leadId: target.lead_id,
        content,
        campaignId,
        aiGenerated: campaign.mode === "ai_per_lead",
      });

      if (result.ok) {
        await supabase
          .from("campaign_targets")
          .update({
            status: "sent",
            sent_message_id: result.messageId,
          })
          .eq("campaign_id", campaignId)
          .eq("lead_id", target.lead_id);
        sent++;
        await incrementCounter(supabase, campaignId, "sent_count");
      } else {
        await supabase
          .from("campaign_targets")
          .update({
            status: "failed",
            error_message: result.error ?? result.reason,
          })
          .eq("campaign_id", campaignId)
          .eq("lead_id", target.lead_id);
        failed++;
        await incrementCounter(supabase, campaignId, "failed_count");
      }

      if (i < targetList.length - 1) await sleep(throttleMs);
    }
  }

  // Status terminal: `completed` significa "rodou até o fim" (não cancelada).
  // Distinção partial-success vs 100% falha é feita pela UI lendo
  // `failed_count` — não há `completed_with_errors` no enum (#131).
  const { data: finalCampaign } = await supabase
    .from("campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle<{ status: string }>();
  if (finalCampaign?.status !== "cancelled") {
    await supabase
      .from("campaigns")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaignId);
  }

  return { sent, failed };
}

async function incrementCounter(
  supabase: SupabaseClient<Database>,
  campaignId: string,
  column: "sent_count" | "failed_count",
) {
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
