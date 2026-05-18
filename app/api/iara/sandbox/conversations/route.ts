import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";

/**
 * GET /api/iara/sandbox/conversations — lista paginada de conversas
 * Iara do usuário autenticado. Usada pelo dashboard de revisão (Fase
 * 1 UI) e pelo seletor de leads no sandbox.
 *
 * Decisão arquitetural: usa service-role + filtro explícito `eq('user_id',
 * userId)` em vez de cliente autenticado. Motivo: precisamos agregar
 * counts (messages, handoffs) e join leve com `leads`. Com service-role
 * o PostgREST monta a query inteira sem ping-pong de RLS. Já que o
 * `user_id` vem do session/cookie via `supabase.auth.getUser`, o filtro
 * explícito é seguro.
 */

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().datetime().optional(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  handoffPriority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  leadId: z.string().uuid().optional(),
});

export interface SandboxConversationListItem {
  id: string;
  leadId: string;
  leadBusinessName: string;
  leadCity: string | null;
  iaraVersion: string;
  isSandbox: boolean;
  lastMessageAt: string | null;
  messageCount: number;
  handoffCount: number;
  latestHandoffPriority: "P0" | "P1" | "P2" | "P3" | null;
  approvalStatus: "pending" | "approved" | "rejected";
  createdAt: string;
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
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    approvalStatus: url.searchParams.get("approvalStatus") ?? undefined,
    handoffPriority: url.searchParams.get("handoffPriority") ?? undefined,
    leadId: url.searchParams.get("leadId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Query inválida",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const { limit, cursor, approvalStatus, leadId, handoffPriority } =
    parsed.data;

  try {
    const service = createServiceSupabase();

    // 1. Query principal: conversas do user com join de leads.
    type ConversationRow = {
      id: string;
      lead_id: string;
      iara_version: string;
      is_sandbox: boolean;
      last_message_at: string | null;
      approval_status: "pending" | "approved" | "rejected";
      created_at: string;
      leads: { name: string | null; city: string | null } | null;
    };

    let q = service
      .from("whatsapp_conversations")
      .select(
        "id, lead_id, iara_version, is_sandbox, last_message_at, approval_status, created_at, leads(name, city)",
      )
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (approvalStatus) q = q.eq("approval_status", approvalStatus);
    if (leadId) q = q.eq("lead_id", leadId);
    if (cursor) q = q.lt("last_message_at", cursor);

    const { data: rows, error } = await q;
    if (error) {
      throw new Error(`Falha ao listar conversas: ${error.message}`);
    }

    const conversations = (rows ?? []) as unknown as ConversationRow[];
    const conversationIds = conversations.map((c) => c.id);

    if (conversationIds.length === 0) {
      return NextResponse.json({ items: [], nextCursor: null });
    }

    // 2. Counts paralelos: mensagens e handoffs por conversa.
    const [messagesResult, handoffsResult] = await Promise.all([
      service
        .from("iara_messages")
        .select("conversation_id")
        .in("conversation_id", conversationIds),
      service
        .from("iara_handoffs")
        .select("conversation_id, priority, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false }),
    ]);

    if (messagesResult.error) {
      throw new Error(
        `Falha ao contar mensagens: ${messagesResult.error.message}`,
      );
    }
    if (handoffsResult.error) {
      throw new Error(
        `Falha ao listar handoffs: ${handoffsResult.error.message}`,
      );
    }

    const messageRows = (messagesResult.data ?? []) as Array<{
      conversation_id: string;
    }>;
    const handoffRows = (handoffsResult.data ?? []) as Array<{
      conversation_id: string;
      priority: "P0" | "P1" | "P2" | "P3";
      created_at: string;
    }>;

    const messageCount = new Map<string, number>();
    for (const row of messageRows) {
      messageCount.set(
        row.conversation_id,
        (messageCount.get(row.conversation_id) ?? 0) + 1,
      );
    }

    const handoffCount = new Map<string, number>();
    const latestHandoff = new Map<string, "P0" | "P1" | "P2" | "P3">();
    for (const row of handoffRows) {
      handoffCount.set(
        row.conversation_id,
        (handoffCount.get(row.conversation_id) ?? 0) + 1,
      );
      // Como ordenamos DESC por created_at, o primeiro encontrado para
      // cada conversa é o mais recente.
      if (!latestHandoff.has(row.conversation_id)) {
        latestHandoff.set(row.conversation_id, row.priority);
      }
    }

    let items: SandboxConversationListItem[] = conversations.map((c) => ({
      id: c.id,
      leadId: c.lead_id,
      leadBusinessName: c.leads?.name ?? "(sem nome)",
      leadCity: c.leads?.city ?? null,
      iaraVersion: c.iara_version,
      isSandbox: c.is_sandbox,
      lastMessageAt: c.last_message_at,
      messageCount: messageCount.get(c.id) ?? 0,
      handoffCount: handoffCount.get(c.id) ?? 0,
      latestHandoffPriority: latestHandoff.get(c.id) ?? null,
      approvalStatus: c.approval_status,
      createdAt: c.created_at,
    }));

    // 3. Filtro de handoffPriority é aplicado em memória — ele depende
    //    do "último handoff", não de qualquer handoff existente.
    if (handoffPriority) {
      items = items.filter(
        (item) => item.latestHandoffPriority === handoffPriority,
      );
    }

    const last = items[items.length - 1];
    const nextCursor =
      items.length === limit && last?.lastMessageAt ? last.lastMessageAt : null;

    return NextResponse.json({ items, nextCursor });
  } catch (error) {
    return apiErrorResponse(
      error,
      { route: "GET /api/iara/sandbox/conversations", userId: user.id },
      "Falha ao listar conversas da Iara. Tente novamente.",
    );
  }
}
