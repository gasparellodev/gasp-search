import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MessageHistory } from "@/components/ai/message-history";
import { LeadSiteCard } from "@/components/leads/lead-site-card";
import { LeadTabs } from "@/components/leads/lead-tabs";
import { Button } from "@/components/ui/button";
import { listLeadMessages } from "@/lib/ai/messages";
import { getLead } from "@/lib/leads/crud";
import { listTags } from "@/lib/leads/list-tags";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * `maxDuration = 90` — Sprint 2 / #A3 (issue #217).
 *
 * O `<LeadSiteCardActions>` aninhado nesta rota dispara a Server Action
 * `regenerateVisualIdentity` (#216) que chama OpenAI Images API em 9
 * prompts paralelos (`p-limit(env.OPENAI_IMAGE_CONCURRENCY ?? 2)`),
 * com wallclock típico de 30-60s em Tier-1. Vercel Pro permite até
 * 300s; 90s é folga sobre o target sem desperdiçar quota.
 *
 * Não pode ser declarado em `app/actions/lead-site.ts` — `'use server'`
 * files só exportam funções async (Next 16 build error). O limite vive
 * na rota que monta o Client Component que dispara a Action.
 */
export const maxDuration = 90;

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseMessagesPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: LeadDetailPageProps) {
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const messagesPage = parseMessagesPage(rawSearchParams.messagesPage);
  const supabase = await createServerSupabase();

  const [lead, tags] = await Promise.all([
    getLead({ supabase, id }),
    listTags({ supabase }),
  ]);

  if (!lead) {
    notFound();
  }

  const messages = await listLeadMessages({
    supabase,
    leadId: lead.id,
    page: messagesPage,
  });

  // Default tab respeita `?messagesPage` para deeplinks vindos do histórico
  // (preserva o comportamento da rota anterior — `Tabs.defaultValue` antes
  // de #136 alternava entre `generate` e `history` baseado neste param).
  const defaultTab = rawSearchParams.messagesPage ? "messages" : "overview";

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/leads">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Leads
        </Link>
      </Button>

      <LeadTabs
        lead={lead}
        mode="standalone"
        tags={tags}
        defaultTab={defaultTab}
        siteCard={
          <LeadSiteCard
            leadId={lead.id}
            leadSummary={{
              name: lead.name,
              phone: lead.phone,
              email: lead.email,
              website: lead.website,
              instagram_handle: lead.instagram_handle,
              city: lead.city,
              state: lead.state,
            }}
          />
        }
        messageHistory={
          <MessageHistory
            leadId={lead.id}
            messages={messages.messages}
            page={messages.page}
            totalPages={messages.totalPages}
            totalCount={messages.totalCount}
          />
        }
      />
    </div>
  );
}
