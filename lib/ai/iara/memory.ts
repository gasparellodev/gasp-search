import "server-only";
import { createServiceSupabase } from "@/lib/supabase/service";
import { IARA_VERSION } from "@/lib/ai/iara/system-prompt";

/**
 * Memória persistente do agente Iara — wrapper em torno das tabelas
 * `whatsapp_conversations`, `iara_messages` e `iara_handoffs` criadas
 * na migration 0025.
 *
 * Server-only por desenho: usa service-role para gravar com snapshot
 * do `user_id` resolvido a partir do endpoint (autenticado via
 * cookie). Em Fase 2, o webhook do Evolution chama daqui também
 * resolvendo o user via `whatsapp_instances.evo_instance`.
 *
 * Contract para o endpoint da Fase 1:
 *   1. `getOrCreateConversation` — idempotente por (lead_id, user_id).
 *      Snapshota `iara_version` na criação. Se a versão mudar entre
 *      sessões, a conversa antiga mantém a versão original (audit
 *      trail). Próxima conversa (lead novo / depois de reset) usa a
 *      versão corrente. Não tentamos "upgrade automático".
 *   2. `appendMessage` — registra um turn (role + content + tool_calls).
 *      Atualiza `last_message_at` na conversa para sort do dashboard.
 *   3. `loadHistory` — devolve todos os turnos ordenados ASC, prontos
 *      para o array `messages` que vai pro Anthropic.
 *   4. `recordHandoff` — registra escalação P0-P3 com motivo livre.
 *      Não resolve nada automaticamente; founder revisa via UI.
 */

export interface ConversationRef {
  id: string;
  iaraVersion: string;
}

export interface GetOrCreateConversationOpts {
  leadId: string;
  userId: string;
  isSandbox: boolean;
}

export interface AppendMessageOpts {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: unknown[] | null;
}

export interface RecordHandoffOpts {
  conversationId: string;
  priority: "P0" | "P1" | "P2" | "P3";
  motivo: string;
}

export interface HistoryEntry {
  role: "user" | "assistant";
  content: string;
  toolCalls: unknown[] | null;
}

/**
 * Procura conversa existente (mesma `lead_id`/`user_id`) ou cria uma
 * nova snapshotando a `IARA_VERSION` corrente.
 *
 * Decisão arquitetural: 1 conversa por (lead, user). Se quisermos
 * "começar do zero", basta deletar a conversa antiga (CASCADE
 * limpa `iara_messages` + `iara_handoffs`). Permite "retomar" o
 * histórico depois de dias sem perder contexto.
 */
export async function getOrCreateConversation(
  opts: GetOrCreateConversationOpts,
): Promise<ConversationRef> {
  const supabase = createServiceSupabase();

  const existing = await supabase
    .from("whatsapp_conversations")
    .select("id, iara_version")
    .eq("lead_id", opts.leadId)
    .eq("user_id", opts.userId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(
      `Falha ao buscar conversa existente: ${existing.error.message}`,
    );
  }

  if (existing.data) {
    return {
      id: existing.data.id as string,
      iaraVersion: existing.data.iara_version as string,
    };
  }

  const inserted = await supabase
    .from("whatsapp_conversations")
    .insert({
      lead_id: opts.leadId,
      user_id: opts.userId,
      iara_version: IARA_VERSION,
      is_sandbox: opts.isSandbox,
    })
    .select("id, iara_version")
    .single();

  if (inserted.error || !inserted.data) {
    throw new Error(
      `Falha ao criar conversa: ${inserted.error?.message ?? "desconhecido"}`,
    );
  }

  return {
    id: inserted.data.id as string,
    iaraVersion: inserted.data.iara_version as string,
  };
}

/**
 * Anexa 1 turno à conversa. `tool_calls` é opcional — relevante apenas
 * em turnos de role='assistant' que executaram tools. Para role='user'
 * sempre passa null (clients/leads nunca chamam tools).
 *
 * Side effect: bump `last_message_at` na conversa para sort do
 * dashboard. Atualização separada (não trigger SQL) para evitar
 * cascata de triggers e manter o controle no app.
 */
export async function appendMessage(opts: AppendMessageOpts): Promise<void> {
  const supabase = createServiceSupabase();

  // tool_calls é JSONB no banco; o tipo gerado é `Json | null`, mas
  // como o array vem do payload do Anthropic (unknown[]) precisamos
  // cast explícito para satisfazer o type narrowing. Serialização real
  // fica por conta do PostgREST.
  const inserted = await supabase.from("iara_messages").insert({
    conversation_id: opts.conversationId,
    role: opts.role,
    content: opts.content,
    tool_calls: (opts.toolCalls ?? null) as unknown as never,
  });

  if (inserted.error) {
    throw new Error(
      `Falha ao gravar mensagem: ${inserted.error.message}`,
    );
  }

  const bump = await supabase
    .from("whatsapp_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", opts.conversationId);

  if (bump.error) {
    throw new Error(
      `Falha ao atualizar last_message_at: ${bump.error.message}`,
    );
  }
}

/**
 * Carrega o histórico completo da conversa ordenado por `created_at`
 * ascendente — pronto pra montar o array `messages` do Anthropic.
 *
 * Sem paginação na Fase 1: contexto de WhatsApp raramente passa de
 * 50 turnos. Se virar problema, em Fase 2 introduzimos sliding
 * window mantendo só os N últimos turnos + sumário dos antigos.
 */
export async function loadHistory(
  conversationId: string,
): Promise<HistoryEntry[]> {
  const supabase = createServiceSupabase();

  const result = await supabase
    .from("iara_messages")
    .select("role, content, tool_calls")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (result.error) {
    throw new Error(`Falha ao carregar histórico: ${result.error.message}`);
  }

  const rows = (result.data ?? []) as Array<{
    role: string;
    content: string;
    tool_calls: unknown;
  }>;

  return rows.map((row) => ({
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
    toolCalls: Array.isArray(row.tool_calls)
      ? (row.tool_calls as unknown[])
      : null,
  }));
}

/**
 * Registra escalação P0-P3. Retorna apenas o id pro caller poder
 * relacionar com o tool_result (a Iara não fala do ID pro cliente).
 */
export async function recordHandoff(
  opts: RecordHandoffOpts,
): Promise<{ id: string }> {
  const supabase = createServiceSupabase();

  const inserted = await supabase
    .from("iara_handoffs")
    .insert({
      conversation_id: opts.conversationId,
      priority: opts.priority,
      motivo: opts.motivo,
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data) {
    throw new Error(
      `Falha ao gravar handoff: ${inserted.error?.message ?? "desconhecido"}`,
    );
  }

  return { id: inserted.data.id as string };
}
