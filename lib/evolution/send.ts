import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createEvolutionClient, EvolutionApiError } from "@/lib/evolution/client";
import type { Database } from "@/types/database";

// Função pura de envio reutilizada por:
//   - app/api/whatsapp/send/route.ts (1-a-1 em #97)
//   - app/api/campaigns/route.ts (processor de campanha em #101)
//
// Responsabilidades:
//   1. Validar que o user tem instância conectada
//   2. Buscar lead (RLS) e extrair phone normalizado
//   3. INSERT lead_messages com status='queued'
//   4. Chamar Evolution sendText
//   5. Atualizar status para 'sent' (com whatsapp_msg_id) ou 'failed'
//   6. Promover lead.stage 'new' → 'contacted' no primeiro outbound
//
// Não lida com auth ou rate-limit — a API route é responsável.

export type SendOutcome =
  | {
      ok: true;
      messageId: string;
      whatsappMsgId: string;
    }
  | {
      ok: false;
      messageId?: string;
      reason:
        | "instance_disconnected"
        | "lead_not_found"
        | "lead_missing_phone"
        | "evolution_error";
      error?: string;
    };

export type SendInput = {
  supabase: SupabaseClient<Database>;
  userId: string;
  leadId: string;
  content: string;
  campaignId?: string | null;
  aiGenerated?: boolean;
};

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 8) return null;
  return digits;
}

export async function sendWhatsAppMessage({
  supabase,
  userId,
  leadId,
  content,
  campaignId = null,
  aiGenerated = false,
}: SendInput): Promise<SendOutcome> {
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("evo_instance, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!instance || instance.status !== "connected") {
    return { ok: false, reason: "instance_disconnected" };
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id, phone, whatsapp, stage")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { ok: false, reason: "lead_not_found" };

  const phone = normalizePhone(lead.whatsapp ?? lead.phone);
  if (!phone) return { ok: false, reason: "lead_missing_phone" };

  // INSERT primeiro pra ter messageId para retornar ao caller; status='queued'
  // garante que se o crash acontecer entre INSERT e Evolution, a row existe
  // pra reconciliação manual ou retry.
  const { data: inserted, error: insertError } = await supabase
    .from("lead_messages")
    .insert({
      lead_id: leadId,
      user_id: userId,
      channel: "whatsapp",
      content,
      direction: "outbound",
      status: "queued",
      ai_generated: aiGenerated,
      campaign_id: campaignId,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      reason: "evolution_error",
      error: insertError?.message ?? "INSERT lead_messages falhou",
    };
  }

  try {
    const evolution = createEvolutionClient();
    const sent = await evolution.sendText(instance.evo_instance, phone, content);
    await supabase
      .from("lead_messages")
      .update({
        status: "sent",
        whatsapp_msg_id: sent.messageId,
      })
      .eq("id", inserted.id);

    // Primeiro outbound: promove stage do lead.
    if (lead.stage === "new" || lead.stage === "contacted") {
      // 'new' → 'contacted'. 'contacted' → mantém (já foi).
      if (lead.stage === "new") {
        await supabase
          .from("leads")
          .update({ stage: "contacted" })
          .eq("id", leadId);
      }
    }

    return {
      ok: true,
      messageId: inserted.id,
      whatsappMsgId: sent.messageId,
    };
  } catch (error) {
    const errMessage =
      error instanceof EvolutionApiError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : "evolution falhou";

    await supabase
      .from("lead_messages")
      .update({
        status: "failed",
        error_message: errMessage,
      })
      .eq("id", inserted.id);

    return {
      ok: false,
      messageId: inserted.id,
      reason: "evolution_error",
      error: errMessage,
    };
  }
}
