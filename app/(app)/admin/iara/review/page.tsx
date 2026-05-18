import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { IaraReviewClient } from "@/components/iara/iara-review-client";
import type {
  IaraConversationListItem,
  IaraHandoffPriority,
} from "@/components/iara/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Iara · Revisão" };

interface ReviewPageProps {
  searchParams: Promise<{
    approvalStatus?: string;
    handoffPriority?: string;
  }>;
}

interface ConversationRow {
  id: string;
  lead_id: string;
  iara_version: string;
  is_sandbox: boolean;
  last_message_at: string | null;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  leads: { name: string | null; city: string | null } | null;
}

async function loadList(
  userId: string,
  approvalStatus: string | undefined,
  handoffPriority: string | undefined,
): Promise<IaraConversationListItem[]> {
  const service = createServiceSupabase();

  let q = service
    .from("whatsapp_conversations")
    .select(
      "id, lead_id, iara_version, is_sandbox, last_message_at, approval_status, created_at, leads(name, city)",
    )
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (
    approvalStatus === "pending" ||
    approvalStatus === "approved" ||
    approvalStatus === "rejected"
  ) {
    q = q.eq("approval_status", approvalStatus);
  }

  const { data } = await q;
  const conversations = (data ?? []) as unknown as ConversationRow[];
  const ids = conversations.map((c) => c.id);
  if (ids.length === 0) return [];

  const [msgs, handoffs] = await Promise.all([
    service
      .from("iara_messages")
      .select("conversation_id")
      .in("conversation_id", ids),
    service
      .from("iara_handoffs")
      .select("conversation_id, priority, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  const messageCount = new Map<string, number>();
  for (const row of (msgs.data ?? []) as Array<{ conversation_id: string }>) {
    messageCount.set(
      row.conversation_id,
      (messageCount.get(row.conversation_id) ?? 0) + 1,
    );
  }
  const handoffCount = new Map<string, number>();
  const latestHandoff = new Map<string, IaraHandoffPriority>();
  for (const row of (handoffs.data ?? []) as Array<{
    conversation_id: string;
    priority: IaraHandoffPriority;
  }>) {
    handoffCount.set(
      row.conversation_id,
      (handoffCount.get(row.conversation_id) ?? 0) + 1,
    );
    if (!latestHandoff.has(row.conversation_id)) {
      latestHandoff.set(row.conversation_id, row.priority);
    }
  }

  let items = conversations.map<IaraConversationListItem>((c) => ({
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

  if (
    handoffPriority === "P0" ||
    handoffPriority === "P1" ||
    handoffPriority === "P2" ||
    handoffPriority === "P3"
  ) {
    items = items.filter(
      (i) => i.latestHandoffPriority === handoffPriority,
    );
  }
  return items;
}

export default async function IaraReviewPage({ searchParams }: ReviewPageProps) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { approvalStatus, handoffPriority } = await searchParams;
  const items = await loadList(user.id, approvalStatus, handoffPriority);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="sk-h1">Iara · Revisão</h1>
        <p className="sk-body-lg text-muted-foreground mt-2">
          Auditoria de conversas simuladas. Aprove ou reprove pra calibrar o
          tom e os handoffs antes do go-live.
        </p>
      </header>

      <IaraReviewClient initialItems={items} />
    </div>
  );
}
