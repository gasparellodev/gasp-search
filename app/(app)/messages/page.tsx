import { redirect } from "next/navigation";
import { ConversationList } from "@/components/messages/conversation-list";
import { InstanceBanner } from "@/components/messages/instance-banner";
import { publicEnv } from "@/lib/env-public";
import { listConversations } from "@/lib/messages/list-conversations";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Mensagens" };
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  if (publicEnv.NEXT_PUBLIC_WHATSAPP_ENABLED !== "1") redirect("/dashboard");

  const supabase = await createServerSupabase();
  const conversations = await listConversations(supabase);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <InstanceBanner />
      <div className="flex flex-1 min-h-0">
        <ConversationList initial={conversations} selectedLeadId={null} />
        <main className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Selecione uma conversa para começar.
        </main>
      </div>
    </div>
  );
}
