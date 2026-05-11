import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MessageHistory } from "@/components/ai/message-history";
import { MessageGenerator } from "@/components/ai/message-generator";
import { LeadSiteCard } from "@/components/leads/lead-site-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listLeadMessages } from "@/lib/ai/messages";
import { getLead } from "@/lib/leads/crud";
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

function compact(parts: Array<string | null>): string {
  return parts.filter(Boolean).join(" / ");
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
  const lead = await getLead({ supabase, id });

  if (!lead) {
    notFound();
  }

  const messages = await listLeadMessages({
    supabase,
    leadId: lead.id,
    page: messagesPage,
  });
  const location = compact([lead.city, lead.state, lead.country]);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/leads">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Leads
        </Link>
      </Button>

      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="sk-h1">{lead.name}</h1>
            <p className="sk-body-lg text-muted-foreground mt-2">
              {compact([lead.category, location]) || "Lead sem categoria"}
            </p>
          </div>
          <Badge variant="secondary">{lead.stage}</Badge>
        </div>
      </header>

      <section className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-muted-foreground text-xs uppercase">Site</p>
          <p className="mt-1 font-medium">{lead.website ?? "Sem site"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase">Email</p>
          <p className="mt-1 font-medium">{lead.email ?? "Sem email"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase">Telefone</p>
          <p className="mt-1 font-medium">{lead.phone ?? "Sem telefone"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase">Score</p>
          <p className="mt-1 font-medium">{lead.score}/100</p>
        </div>
      </section>

      <LeadSiteCard leadId={lead.id} />

      <Tabs
        defaultValue={rawSearchParams.messagesPage ? "history" : "generate"}
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="generate">Gerar</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="generate">
          <MessageGenerator leadId={lead.id} />
        </TabsContent>
        <TabsContent value="history">
          <MessageHistory
            leadId={lead.id}
            messages={messages.messages}
            page={messages.page}
            totalPages={messages.totalPages}
            totalCount={messages.totalCount}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
