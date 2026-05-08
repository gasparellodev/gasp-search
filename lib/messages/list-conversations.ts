import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// ----------------------------------------------------------------------------
// Lista de threads para a inbox /messages: 1 entrada por lead com:
//   - última mensagem (content + created_at + direction + status)
//   - dados básicos do lead (id, name, phone)
//
// Server-side: busca todas as msgs do user (RLS já filtra), agrupa por lead_id
// pegando a mais recente, e enriquece com lead.name. Para escala maior, viraria
// uma view ou RPC; no MVP a quantidade de mensagens por user fica controlada.
// ----------------------------------------------------------------------------

export type ConversationItem = {
  leadId: string;
  leadName: string;
  leadPhone: string | null;
  lastContent: string;
  lastCreatedAt: string;
  lastDirection: "outbound" | "inbound";
  lastStatus: "queued" | "sent" | "delivered" | "read" | "failed";
};

export async function listConversations(
  supabase: SupabaseClient<Database>,
): Promise<ConversationItem[]> {
  // Inbox = chat real. Mensagens só aparecem se entraram (inbound) ou
  // foram efetivamente enviadas pelo Evolution (whatsapp_msg_id NOT NULL).
  // Drafts de IA salvos pelo /api/ai/generate-message ficam de fora.
  const { data: messages, error: msgErr } = await supabase
    .from("lead_messages")
    .select("lead_id, content, created_at, direction, status")
    .or("direction.eq.inbound,whatsapp_msg_id.not.is.null")
    .order("created_at", { ascending: false });
  if (msgErr) throw new Error(`Falha listar mensagens: ${msgErr.message}`);

  if (!messages || messages.length === 0) return [];

  const seen = new Set<string>();
  const grouped: Array<{
    leadId: string;
    lastContent: string;
    lastCreatedAt: string;
    lastDirection: "outbound" | "inbound";
    lastStatus: ConversationItem["lastStatus"];
  }> = [];
  for (const m of messages) {
    if (seen.has(m.lead_id)) continue;
    seen.add(m.lead_id);
    grouped.push({
      leadId: m.lead_id,
      lastContent: m.content,
      lastCreatedAt: m.created_at,
      lastDirection: m.direction,
      lastStatus: m.status,
    });
  }

  if (grouped.length === 0) return [];

  const leadIds = grouped.map((g) => g.leadId);
  const { data: leads, error: leadsErr } = await supabase
    .from("leads")
    .select("id, name, phone, whatsapp")
    .in("id", leadIds);
  if (leadsErr) throw new Error(`Falha listar leads: ${leadsErr.message}`);

  const leadMap = new Map<
    string,
    { name: string; phone: string | null }
  >();
  for (const lead of leads ?? []) {
    leadMap.set(lead.id, {
      name: lead.name,
      phone: lead.whatsapp ?? lead.phone ?? null,
    });
  }

  return grouped
    .map((g) => {
      const meta = leadMap.get(g.leadId);
      if (!meta) return null;
      return {
        leadId: g.leadId,
        leadName: meta.name,
        leadPhone: meta.phone,
        lastContent: g.lastContent,
        lastCreatedAt: g.lastCreatedAt,
        lastDirection: g.lastDirection,
        lastStatus: g.lastStatus,
      };
    })
    .filter((x): x is ConversationItem => x !== null);
}
