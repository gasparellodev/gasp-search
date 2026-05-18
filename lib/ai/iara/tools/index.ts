import "server-only";
import { createServiceSupabase } from "@/lib/supabase/service";
import { recordHandoff } from "@/lib/ai/iara/memory";
import type { IaraToolName } from "@/lib/ai/iara/system-prompt";

/**
 * Handlers das 6 tools da Iara (Fase 1 — sandbox-friendly).
 *
 * Contract:
 *  - Cada handler recebe `(input: unknown, ctx: { userId, conversationId })`.
 *  - `input` é o objeto bruto vindo do `tool_use` do Anthropic. O
 *    schema declarado em `IARA_TOOLS` (lib/ai/iara/system-prompt.ts)
 *    garante o shape; aqui aplicamos narrowing defensivo apenas pros
 *    campos que efetivamente usamos.
 *  - Toda escrita é com `user_id = ctx.userId` (simula RLS porque
 *    estamos usando service-role).
 *  - Retorno é o `content` do `tool_result` block — JSON serializável.
 *
 * Stubs intencionais (Fase 2 trocará por implementações reais):
 *  - `gerar_link_checkout` retorna URL fake do sandbox Asaas.
 *  - `consultar_estado_lead` calcula `estoque_count_estimate` como 0
 *    (não temos `lead_inventory` ainda).
 *  - `agendar_followup` persiste em `iara_scheduled_followups` mas o
 *    worker que dispara as mensagens é da Fase 2.
 */

export interface IaraToolContext {
  userId: string;
  conversationId: string;
  leadId: string;
}

export type IaraToolHandler = (
  input: unknown,
  ctx: IaraToolContext,
) => Promise<unknown>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

const consultarEstadoLead: IaraToolHandler = async (input, ctx) => {
  const _payload = asRecord(input);
  void _payload; // lead_id vem no payload, mas usamos ctx.leadId (truth)

  const supabase = createServiceSupabase();
  const lead = await supabase
    .from("leads")
    .select("name, city, has_website, stage")
    .eq("id", ctx.leadId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (lead.error) {
    throw new Error(`Falha ao consultar lead: ${lead.error.message}`);
  }

  if (!lead.data) {
    // Sandbox-friendly: se o lead não existe, retorna placeholder
    // pra Iara não travar.
    return {
      business_name: "[lead não encontrado]",
      city: null,
      has_existing_site: false,
      estoque_count_estimate: 0,
      stage: "new",
    };
  }

  return {
    business_name: lead.data.name as string,
    city: (lead.data.city as string | null) ?? null,
    has_existing_site: Boolean(lead.data.has_website),
    // Phase 2: integra com `lead_inventory` ou contagem real do
    // estoque sincronizado. Hoje retornamos 0 (placeholder).
    estoque_count_estimate: 0,
    stage: (lead.data.stage as string) ?? "new",
  };
};

const gerarLinkCheckout: IaraToolHandler = async (input, ctx) => {
  const payload = asRecord(input);
  const plano = asString(payload.plano, "setup_mensal");
  void plano;

  // Fase 2 troca por chamada real ao Asaas. Hoje só devolve URL fake
  // que parece com formato Asaas (subdomain sandbox).
  return {
    url: `https://sandbox.asaas.com/c/${ctx.leadId}`,
    expires_in_hours: 24,
  };
};

const escalarParaHumano: IaraToolHandler = async (input, ctx) => {
  const payload = asRecord(input);
  const rawPriority = asString(payload.priority, "P2");
  const priority = (
    ["P0", "P1", "P2", "P3"].includes(rawPriority) ? rawPriority : "P2"
  ) as "P0" | "P1" | "P2" | "P3";
  const motivo = asString(payload.motivo, "(sem motivo informado)");

  const { id } = await recordHandoff({
    conversationId: ctx.conversationId,
    priority,
    motivo,
  });

  return { ok: true, handoff_id: id, priority };
};

const agendarFollowup: IaraToolHandler = async (input, ctx) => {
  const payload = asRecord(input);
  const dias =
    typeof payload.dias_a_frente === "number" &&
    Number.isFinite(payload.dias_a_frente)
      ? Math.max(2, Math.min(7, Math.trunc(payload.dias_a_frente)))
      : 3;
  const mensagem = asString(payload.mensagem, "Oi, retomando nosso papo!");

  const scheduledFor = new Date();
  scheduledFor.setUTCDate(scheduledFor.getUTCDate() + dias);

  const supabase = createServiceSupabase();
  const inserted = await supabase
    .from("iara_scheduled_followups")
    .insert({
      conversation_id: ctx.conversationId,
      lead_id: ctx.leadId,
      user_id: ctx.userId,
      mensagem,
      scheduled_for: scheduledFor.toISOString(),
    })
    .select("id, scheduled_for")
    .single();

  if (inserted.error || !inserted.data) {
    throw new Error(
      `Falha ao agendar follow-up: ${inserted.error?.message ?? "desconhecido"}`,
    );
  }

  return {
    ok: true,
    scheduled_for: inserted.data.scheduled_for as string,
    followup_id: inserted.data.id as string,
  };
};

const marcarLeadMorto: IaraToolHandler = async (input, ctx) => {
  const payload = asRecord(input);
  const motivo = asString(payload.motivo, "no_response_30d");

  const supabase = createServiceSupabase();

  // Buscar lead atual pra preservar `notes` (concatena, não sobrescreve).
  const current = await supabase
    .from("leads")
    .select("notes")
    .eq("id", ctx.leadId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (current.error) {
    throw new Error(`Falha ao buscar lead: ${current.error.message}`);
  }

  const previousNotes = (current.data?.notes as string | null) ?? "";
  const stamp = new Date().toISOString();
  const appendedNote = `[Iara ${stamp}] marcado como morto — motivo: ${motivo}`;
  const newNotes = previousNotes
    ? `${previousNotes}\n${appendedNote}`
    : appendedNote;

  const update = await supabase
    .from("leads")
    .update({ stage: "closed_lost", notes: newNotes })
    .eq("id", ctx.leadId)
    .eq("user_id", ctx.userId);

  if (update.error) {
    throw new Error(
      `Falha ao marcar lead morto: ${update.error.message}`,
    );
  }

  return { ok: true, motivo };
};

const marcarDemandaNaoAtendida: IaraToolHandler = async (input, ctx) => {
  const payload = asRecord(input);
  const feature = asString(payload.feature_solicitada, "(não especificado)");

  const supabase = createServiceSupabase();
  const inserted = await supabase
    .from("iara_demand_signals")
    .insert({
      conversation_id: ctx.conversationId,
      lead_id: ctx.leadId,
      user_id: ctx.userId,
      feature_solicitada: feature,
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data) {
    throw new Error(
      `Falha ao registrar demanda: ${inserted.error?.message ?? "desconhecido"}`,
    );
  }

  return { ok: true, signal_id: inserted.data.id as string };
};

export const IARA_TOOL_HANDLERS: Record<IaraToolName, IaraToolHandler> = {
  consultar_estado_lead: consultarEstadoLead,
  gerar_link_checkout: gerarLinkCheckout,
  escalar_para_humano: escalarParaHumano,
  agendar_followup: agendarFollowup,
  marcar_lead_morto: marcarLeadMorto,
  marcar_demanda_nao_atendida: marcarDemandaNaoAtendida,
};

export function isIaraToolName(name: string): name is IaraToolName {
  return Object.prototype.hasOwnProperty.call(IARA_TOOL_HANDLERS, name);
}
