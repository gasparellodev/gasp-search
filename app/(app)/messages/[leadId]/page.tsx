import { notFound, redirect } from "next/navigation";
import { ConversationList } from "@/components/messages/conversation-list";
import { ConversationThread } from "@/components/messages/conversation-thread";
import { InstanceBanner } from "@/components/messages/instance-banner";
import { MessageComposer } from "@/components/messages/message-composer";
import { publicEnv } from "@/lib/env-public";
import { listConversations } from "@/lib/messages/list-conversations";
import { createServerSupabase } from "@/lib/supabase/server";

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
    .select("id, name")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) notFound();

  const conversations = await listConversations(supabase);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <InstanceBanner />
      <div className="flex flex-1 min-h-0">
        <ConversationList initial={conversations} selectedLeadId={leadId} />
        <main className="flex flex-1 flex-col min-w-0">
          <header className="border-b px-4 py-3">
            <h1 className="font-medium">{lead.name}</h1>
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
