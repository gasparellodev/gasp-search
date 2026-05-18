import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";

/**
 * GET /api/iara/sandbox/conversation/[id]
 * — devolve a conversa completa (lead + mensagens + handoffs) para
 *   abrir no painel sandbox / review.
 *
 * DELETE /api/iara/sandbox/conversation/[id]
 * — "resetar" a conversa: DELETE em whatsapp_conversations dispara
 *   CASCADE em iara_messages, iara_handoffs, iara_scheduled_followups,
 *   iara_demand_signals. Útil quando o founder quer recomeçar do zero.
 *
 * Ambos exigem ownership: o user_id da conversa precisa bater com o
 * user autenticado. Service-role bypassa RLS, mas o filtro explícito
 * de user_id é redundância defensiva.
 */

export interface SandboxConversationDetail {
  conversation: {
    id: string;
    leadId: string;
    iaraVersion: string;
    isSandbox: boolean;
    lastMessageAt: string | null;
    approvalStatus: "pending" | "approved" | "rejected";
    approvalNotes: string | null;
    reviewedAt: string | null;
    createdAt: string;
  };
  lead: {
    id: string;
    business_name: string;
    city: string | null;
    status: string;
  };
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    toolCalls: unknown[] | null;
    createdAt: string;
  }>;
  handoffs: Array<{
    priority: "P0" | "P1" | "P2" | "P3";
    motivo: string;
    createdAt: string;
    resolvedAt: string | null;
  }>;
}

async function loadOwnedConversation(userId: string, conversationId: string) {
  const service = createServiceSupabase();
  const { data, error } = await service
    .from("whatsapp_conversations")
    .select(
      "id, lead_id, user_id, iara_version, is_sandbox, last_message_at, approval_status, approval_notes, reviewed_at, created_at",
    )
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`Falha ao buscar conversa: ${error.message}`);
  }
  return data as
    | {
        id: string;
        lead_id: string;
        user_id: string;
        iara_version: string;
        is_sandbox: boolean;
        last_message_at: string | null;
        approval_status: "pending" | "approved" | "rejected";
        approval_notes: string | null;
        reviewed_at: string | null;
        created_at: string;
      }
    | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  try {
    const conversation = await loadOwnedConversation(user.id, conversationId);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada" },
        { status: 404 },
      );
    }

    const service = createServiceSupabase();

    const [leadResult, messagesResult, handoffsResult] = await Promise.all([
      service
        .from("leads")
        .select("id, name, city, stage")
        .eq("id", conversation.lead_id)
        .maybeSingle(),
      service
        .from("iara_messages")
        .select("role, content, tool_calls, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true }),
      service
        .from("iara_handoffs")
        .select("priority, motivo, created_at, resolved_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false }),
    ]);

    if (leadResult.error) {
      throw new Error(`Falha ao buscar lead: ${leadResult.error.message}`);
    }
    if (messagesResult.error) {
      throw new Error(
        `Falha ao buscar mensagens: ${messagesResult.error.message}`,
      );
    }
    if (handoffsResult.error) {
      throw new Error(
        `Falha ao buscar handoffs: ${handoffsResult.error.message}`,
      );
    }

    const lead = leadResult.data as {
      id: string;
      name: string;
      city: string | null;
      stage: string;
    } | null;
    if (!lead) {
      return NextResponse.json(
        { error: "Lead da conversa não encontrado" },
        { status: 404 },
      );
    }

    const messageRows = (messagesResult.data ?? []) as Array<{
      role: string;
      content: string;
      tool_calls: unknown;
      created_at: string;
    }>;
    const handoffRows = (handoffsResult.data ?? []) as Array<{
      priority: "P0" | "P1" | "P2" | "P3";
      motivo: string;
      created_at: string;
      resolved_at: string | null;
    }>;

    const body: SandboxConversationDetail = {
      conversation: {
        id: conversation.id,
        leadId: conversation.lead_id,
        iaraVersion: conversation.iara_version,
        isSandbox: conversation.is_sandbox,
        lastMessageAt: conversation.last_message_at,
        approvalStatus: conversation.approval_status,
        approvalNotes: conversation.approval_notes,
        reviewedAt: conversation.reviewed_at,
        createdAt: conversation.created_at,
      },
      lead: {
        id: lead.id,
        business_name: lead.name,
        city: lead.city,
        status: lead.stage,
      },
      messages: messageRows.map((row) => ({
        role: row.role === "assistant" ? "assistant" : "user",
        content: row.content,
        toolCalls: Array.isArray(row.tool_calls)
          ? (row.tool_calls as unknown[])
          : null,
        createdAt: row.created_at,
      })),
      handoffs: handoffRows.map((row) => ({
        priority: row.priority,
        motivo: row.motivo,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
      })),
    };

    return NextResponse.json(body);
  } catch (error) {
    return apiErrorResponse(
      error,
      {
        route: "GET /api/iara/sandbox/conversation/[id]",
        userId: user.id,
      },
      "Falha ao carregar conversa. Tente novamente.",
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  try {
    const conversation = await loadOwnedConversation(user.id, conversationId);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada" },
        { status: 404 },
      );
    }

    const service = createServiceSupabase();
    const { error } = await service
      .from("whatsapp_conversations")
      .delete()
      .eq("id", conversationId)
      .eq("user_id", user.id);

    if (error) {
      throw new Error(`Falha ao remover conversa: ${error.message}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(
      error,
      {
        route: "DELETE /api/iara/sandbox/conversation/[id]",
        userId: user.id,
      },
      "Falha ao resetar conversa. Tente novamente.",
    );
  }
}
