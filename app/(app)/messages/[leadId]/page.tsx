import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ConversationList } from "@/components/messages/conversation-list";
import { ConversationThread } from "@/components/messages/conversation-thread";
import { InstanceBanner } from "@/components/messages/instance-banner";
import { MessageComposer } from "@/components/messages/message-composer";
import { Badge } from "@/components/ui/badge";
import { publicEnv } from "@/lib/env-public";
import { STAGE_LABEL, STAGE_VARIANT } from "@/lib/leads/stage-presentation";
import { listConversations } from "@/lib/messages/list-conversations";
import { createServerSupabase } from "@/lib/supabase/server";
import type { LeadStage } from "@/lib/validators/leads";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ leadId: string }>;
}

export default async function MessagesThreadPage({ params }: PageProps) {
  if (publicEnv.NEXT_PUBLIC_WHATSAPP_ENABLED !== "1") redirect("/dashboard");

  const { leadId } = await params;
  const supabase = await createServerSupabase();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, stage")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) notFound();

  const conversations = await listConversations(supabase);
  const stage = lead.stage as LeadStage;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <InstanceBanner />
      <div className="flex flex-1 min-h-0">
        <ConversationList initial={conversations} selectedLeadId={leadId} />
        <main className="flex flex-1 flex-col min-w-0">
          <header className="flex items-center gap-3 border-b px-4 py-3">
            <Link
              href={`/leads/${lead.id}`}
              className="min-w-0 truncate font-medium hover:underline"
              aria-label={`Abrir ficha de ${lead.name}`}
            >
              <h1 className="truncate font-medium">{lead.name}</h1>
            </Link>
            <Badge variant={STAGE_VARIANT[stage]} className="shrink-0">
              {STAGE_LABEL[stage]}
            </Badge>
          </header>
          <div className="flex-1 min-h-0">
            <ConversationThread leadId={leadId} />
          </div>
          <MessageComposer leadId={leadId} />
        </main>
      </div>
    </div>
  );
}
