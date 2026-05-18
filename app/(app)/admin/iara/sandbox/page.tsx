import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { IaraConversationsList } from "@/components/iara/iara-conversations-list";
import { IaraSandboxClient } from "@/components/iara/iara-sandbox-client";
import type {
  IaraConversationDetail,
  IaraHandoffPriority,
} from "@/components/iara/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Iara · Sandbox" };

interface SandboxPageProps {
  searchParams: Promise<{ leadId?: string }>;
}

interface LeadRow {
  id: string;
  name: string;
  city: string | null;
}

interface ConversationLite {
  lead_id: string;
}

async function loadLeads(userId: string): Promise<LeadRow[]> {
  const service = createServiceSupabase();
  const { data } = await service
    .from("leads")
    .select("id, name, city")
    .eq("user_id", userId)
    .order("name", { ascending: true })
    .limit(500);
  return (data ?? []) as unknown as LeadRow[];
}

async function loadConversationsLite(
  userId: string,
): Promise<ConversationLite[]> {
  const service = createServiceSupabase();
  const { data } = await service
    .from("whatsapp_conversations")
    .select("lead_id")
    .eq("user_id", userId);
  return (data ?? []) as unknown as ConversationLite[];
}

async function loadDetail(
  userId: string,
  leadId: string,
): Promise<IaraConversationDetail | null> {
  const service = createServiceSupabase();
  const convResult = await service
    .from("whatsapp_conversations")
    .select(
      "id, lead_id, iara_version, is_sandbox, last_message_at, approval_status, approval_notes, reviewed_at, created_at",
    )
    .eq("user_id", userId)
    .eq("lead_id", leadId)
    .maybeSingle();
  const conv = (convResult.data ?? null) as {
    id: string;
    lead_id: string;
    iara_version: string;
    is_sandbox: boolean;
    last_message_at: string | null;
    approval_status: "pending" | "approved" | "rejected";
    approval_notes: string | null;
    reviewed_at: string | null;
    created_at: string;
  } | null;
  if (!conv) {
    const leadResult = await service
      .from("leads")
      .select("id, name, city, stage")
      .eq("id", leadId)
      .eq("user_id", userId)
      .maybeSingle();
    const lead = leadResult.data as
      | { id: string; name: string; city: string | null; stage: string }
      | null;
    if (!lead) return null;
    return {
      conversation: {
        id: "",
        leadId: lead.id,
        iaraVersion: "1.1",
        isSandbox: true,
        lastMessageAt: null,
        approvalStatus: "pending",
        approvalNotes: null,
        reviewedAt: null,
        createdAt: new Date().toISOString(),
      },
      lead: {
        id: lead.id,
        business_name: lead.name,
        city: lead.city,
        status: lead.stage,
      },
      messages: [],
      handoffs: [],
    };
  }

  const [leadResult, msgsResult, handoffsResult] = await Promise.all([
    service
      .from("leads")
      .select("id, name, city, stage")
      .eq("id", conv.lead_id)
      .maybeSingle(),
    service
      .from("iara_messages")
      .select("role, content, tool_calls, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true }),
    service
      .from("iara_handoffs")
      .select("priority, motivo, created_at, resolved_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false }),
  ]);

  const lead = leadResult.data as
    | { id: string; name: string; city: string | null; stage: string }
    | null;
  if (!lead) return null;
  const msgs = (msgsResult.data ?? []) as Array<{
    role: string;
    content: string;
    tool_calls: unknown;
    created_at: string;
  }>;
  const handoffs = (handoffsResult.data ?? []) as Array<{
    priority: IaraHandoffPriority;
    motivo: string;
    created_at: string;
    resolved_at: string | null;
  }>;

  return {
    conversation: {
      id: conv.id,
      leadId: conv.lead_id,
      iaraVersion: conv.iara_version,
      isSandbox: conv.is_sandbox,
      lastMessageAt: conv.last_message_at,
      approvalStatus: conv.approval_status,
      approvalNotes: conv.approval_notes,
      reviewedAt: conv.reviewed_at,
      createdAt: conv.created_at,
    },
    lead: {
      id: lead.id,
      business_name: lead.name,
      city: lead.city,
      status: lead.stage,
    },
    messages: msgs.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      toolCalls: Array.isArray(m.tool_calls)
        ? (m.tool_calls as unknown[])
        : null,
      createdAt: m.created_at,
    })),
    handoffs: handoffs.map((h) => ({
      priority: h.priority,
      motivo: h.motivo,
      createdAt: h.created_at,
      resolvedAt: h.resolved_at,
    })),
  };
}

export default async function IaraSandboxPage({
  searchParams,
}: SandboxPageProps) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { leadId } = await searchParams;

  const [leads, conversationsLite, detail] = await Promise.all([
    loadLeads(user.id),
    loadConversationsLite(user.id),
    leadId ? loadDetail(user.id, leadId) : Promise.resolve(null),
  ]);

  const conversationsByLead = new Set(conversationsLite.map((c) => c.lead_id));

  const leadOptions = leads.map((l) => ({
    id: l.id,
    business_name: l.name,
    city: l.city,
    hasConversation: conversationsByLead.has(l.id),
  }));

  return (
    <div className="-m-4 flex h-[calc(100dvh-4rem)] min-h-0 flex-col md:-m-6 md:flex-row">
      <div className="w-full shrink-0 md:w-64">
        <IaraConversationsList
          leads={leadOptions}
          selectedLeadId={leadId ?? null}
        />
      </div>
      {leadId ? (
        <IaraSandboxClient leadId={leadId} initialDetail={detail} />
      ) : (
        <div className="text-muted-foreground flex h-full flex-1 items-center justify-center p-6 text-sm">
          <div className="max-w-md rounded-md border border-dashed p-6 text-center">
            <p className="mb-1 text-base font-medium text-foreground">
              Selecione um lead pra começar
            </p>
            <p>
              A sandbox da Iara conversa em nome do lojista. Escolha um lead
              da lista pra abrir / continuar uma conversa simulada.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
