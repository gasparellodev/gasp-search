import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export const LEAD_MESSAGES_PAGE_SIZE = 20;

export type LeadMessage = Pick<
  Tables<"lead_messages">,
  | "id"
  | "lead_id"
  | "channel"
  | "tone"
  | "content"
  | "created_at"
  | "direction"
  | "status"
  | "whatsapp_msg_id"
  | "campaign_id"
  | "ai_generated"
  | "error_message"
>;

export type ListLeadMessagesResult = {
  messages: LeadMessage[];
  totalCount: number;
  page: number;
  pageSize: typeof LEAD_MESSAGES_PAGE_SIZE;
  totalPages: number;
};

const MESSAGE_SELECT =
  "id, lead_id, channel, tone, content, created_at, direction, status, whatsapp_msg_id, campaign_id, ai_generated, error_message";

// Filtro de "mensagens reais": tudo que entrou (inbound) OU saiu de fato pelo
// Evolution (whatsapp_msg_id NOT NULL). Drafts de IA — gerados pelo
// /api/ai/generate-message mas nunca enviados — ficam de fora.
const REAL_MESSAGES_FILTER = "direction.eq.inbound,whatsapp_msg_id.not.is.null";

export async function listLeadMessages({
  supabase,
  leadId,
  page = 1,
  realOnly = false,
}: {
  supabase: SupabaseClient<Database>;
  leadId: string;
  page?: number;
  realOnly?: boolean;
}): Promise<ListLeadMessagesResult> {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const from = (safePage - 1) * LEAD_MESSAGES_PAGE_SIZE;
  const to = from + LEAD_MESSAGES_PAGE_SIZE - 1;

  const baseQuery = supabase
    .from("lead_messages")
    .select(MESSAGE_SELECT, { count: "exact" })
    .eq("lead_id", leadId);

  const filtered = realOnly ? baseQuery.or(REAL_MESSAGES_FILTER) : baseQuery;

  const { data, count, error } = await filtered
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Falha ao listar mensagens: ${error.message}`);
  }

  const totalCount = count ?? 0;
  const totalPages =
    totalCount === 0 ? 0 : Math.ceil(totalCount / LEAD_MESSAGES_PAGE_SIZE);

  return {
    messages: (data ?? []) as unknown as LeadMessage[],
    totalCount,
    page: safePage,
    pageSize: LEAD_MESSAGES_PAGE_SIZE,
    totalPages,
  };
}
