import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { sendWhatsAppMessage, type SendOutcome } from "@/lib/evolution/send";
import {
  checkDailyInstanceLimit,
  DAILY_INSTANCE_LIMIT,
} from "@/lib/whatsapp/daily-limit";
import { renderTemplate } from "@/lib/whatsapp/render-template";
import { SITE_PREVIEW_TEMPLATE } from "@/lib/whatsapp/templates";
import type { Database } from "@/types/database";

// ----------------------------------------------------------------------------
// dispatchSitePreview — núcleo compartilhado do fluxo "enviar prévia de site
// via WhatsApp". Extraído de `app/actions/lead-site.ts > sendLeadSiteWhatsApp`
// (#171) pra ser reutilizado pelo processor de campanhas em massa (#172).
//
// Diferenças em relação ao Server Action:
//   - **Não faz auth** — o caller já validou o usuário (Server Action faz
//     `auth.getUser()`; processor recebe `userId` da row de campaigns
//     persistida com RLS).
//   - **Não invalida cache** — esse é responsabilidade do caller (Server
//     Action chama `updateTag` / `revalidatePath`; processor não precisa
//     porque a UI da campanha lê uma listagem agregada, não o site público).
//   - **Aceita `supabase` + `service` por DI** — em produção o processor usa
//     o cliente authenticated da request RLS (mesmo da campanha), e o service
//     pra escrever lead_sites.sent. Em testes, mocks substituem os dois.
//
// Contrato de retorno é um discriminated union espelhando a SendOutcome,
// estendido com erros específicos de "lead site não-elegível":
//   - `'no_site'`         — lead não tem row em lead_sites.
//   - `'invalid_status'`  — lead_sites.status NÃO IN ('published','sent').
//   - `'whatsapp_error'`  — falha de transporte (mapeada de SendOutcome.reason).
//   - `'render_error'`    — bug de programação (variável faltante no template).
//   - `'db_error'`        — falha ao escrever lead_sites.sent.
//   - `'rate_limit_daily'` — guard hard de 50 envios/dia/instância (#173).
// ----------------------------------------------------------------------------

export type DispatchSitePreviewResult =
  | { ok: true; leadSiteId: string }
  | {
      ok: false;
      reason:
        | "no_site"
        | "invalid_status"
        | "render_error"
        | "whatsapp_error"
        | "db_error"
        | "rate_limit_daily";
      // Mensagem livre pra log / persist em campaign_targets.error_message.
      message: string;
    };

export type DispatchSitePreviewInput = {
  /** Cliente authenticated (RLS) usado pra ler lead_sites + sendWhatsAppMessage. */
  supabase: SupabaseClient<Database>;
  /** Cliente service-role usado pra atualizar lead_sites.status='sent'. */
  service: SupabaseClient<Database>;
  userId: string;
  leadId: string;
  /** Injeção pra testes — em produção usa `sendWhatsAppMessage` direto. */
  sendImpl?: typeof sendWhatsAppMessage;
};

type LeadSiteRow = {
  id: string;
  slug: string;
  status: "draft" | "published" | "sent" | "archived";
};

export async function dispatchSitePreview({
  supabase,
  service,
  userId,
  leadId,
  sendImpl = sendWhatsAppMessage,
}: DispatchSitePreviewInput): Promise<DispatchSitePreviewResult> {
  // Step 1: Fetch lead_sites por lead_id (RLS isola por user_id).
  // Lead pode não ter site gerado — esse é o branch "skipped/no_site".
  const { data: leadSite } = await supabase
    .from("lead_sites")
    .select("id, slug, status")
    .eq("lead_id", leadId)
    .maybeSingle<LeadSiteRow>();

  if (!leadSite) {
    return {
      ok: false,
      reason: "no_site",
      message: "Lead não possui site gerado.",
    };
  }

  // Step 2: Status guard — re-send permitido (status='sent' aceito).
  if (leadSite.status !== "published" && leadSite.status !== "sent") {
    return {
      ok: false,
      reason: "invalid_status",
      message: `Site em status '${leadSite.status}' — apenas 'published'/'sent' são elegíveis.`,
    };
  }

  // Step 2.5: Guard hard 50 envios/dia/instância (#173). Antes do render+send
  // pra evitar trabalho desperdiçado e zero risco de tocar Evolution acima do
  // limite. Em campanhas em massa, o processor mapeia esse `reason` pra
  // `failed` (não `skipped`) — operador deve ter awareness, não silently skip.
  const limitCheck = await checkDailyInstanceLimit(userId, supabase);
  if (!limitCheck.allowed) {
    return {
      ok: false,
      reason: "rate_limit_daily",
      message: `Limite diário de ${DAILY_INSTANCE_LIMIT} envios atingido para esta instância. Tente amanhã.`,
    };
  }

  // Step 3: Fetch lead.name pra montar `business_name` no template. Defesa
  // em profundidade — RLS já filtra; lead removido vira fallback amigável.
  const { data: leadRow } = await supabase
    .from("leads")
    .select("name")
    .eq("id", leadId)
    .maybeSingle();
  const businessNameRaw = (leadRow?.name ?? "").trim();
  const businessName =
    businessNameRaw.length > 0 ? businessNameRaw : "Concessionária";

  // Step 4: Build site_url + render template.
  const siteUrl = `${env.NEXT_PUBLIC_APP_URL}/sites/${leadSite.slug}`;
  let content: string;
  try {
    content = renderTemplate(SITE_PREVIEW_TEMPLATE, {
      business_name: businessName,
      site_url: siteUrl,
    });
  } catch (cause) {
    // Bug de programação — variable missing no template. Não expõe internals.
    return {
      ok: false,
      reason: "render_error",
      message:
        cause instanceof Error
          ? cause.message
          : "Falha ao renderizar template do site preview.",
    };
  }

  // Step 5: Send via Evolution (helper Phase 6 cobre instance, lead,
  // INSERT lead_messages, sendText, update status, lead.stage promotion).
  const sendOutcome: SendOutcome = await sendImpl({
    supabase,
    userId,
    leadId,
    content,
    aiGenerated: false,
  });

  if (!sendOutcome.ok) {
    return {
      ok: false,
      reason: "whatsapp_error",
      message: sendOutcome.error ?? sendOutcome.reason,
    };
  }

  // Step 6: Update lead_sites (status='sent', sent_at=now) via service_role.
  const nowIso = new Date().toISOString();
  const { error: updateError } = await service
    .from("lead_sites")
    .update({
      status: "sent" as const,
      sent_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", leadSite.id);

  if (updateError) {
    return {
      ok: false,
      reason: "db_error",
      message:
        updateError.message ?? "Falha ao atualizar lead_sites após envio.",
    };
  }

  return { ok: true, leadSiteId: leadSite.id };
}
