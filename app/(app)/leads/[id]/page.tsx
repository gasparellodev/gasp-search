import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MessageGenerator } from "@/components/ai/message-generator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLead } from "@/lib/leads/crud";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

function compact(parts: Array<string | null>): string {
  return parts.filter(Boolean).join(" / ");
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const lead = await getLead({ supabase, id });

  if (!lead) {
    notFound();
  }

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
            <h1 className="text-3xl font-semibold tracking-tight">
              {lead.name}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
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

      <MessageGenerator leadId={lead.id} />
    </div>
  );
}
