/**
 * `<LeadSiteCard />` — Server Component (issue #167).
 *
 * Render do bloco "Site do lead" na ficha `/leads/[id]`. Busca o
 * `lead_sites` row via Supabase (RLS isola por `user_id`), formata
 * datas em PT-BR e delega ações pra `<LeadSiteCardActions />` (client).
 *
 * **Server boundary:** este arquivo NÃO tem `'use client'`. Apenas
 * o cluster de botões é client.
 *
 * **4 estados visuais** (AC1):
 *   - `none` (`leadSite=null` OR `status='draft'`) — CTA gerar
 *   - `published` — URL + botões pré-visualizar/editar/regerar/…
 *   - `sent`      — published + badge "Enviado em…"
 *   - `archived`  — info + botão restaurar (disabled em V1)
 */

import { CheckCircle2, FileX, Mail, MapPin } from "lucide-react";

import { publicEnv } from "@/lib/env-public";
import { createServerSupabase } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { LeadSiteCardActions } from "./lead-site-card-actions";
import type { LeadSiteCardData, LeadSiteStatus } from "./lead-site-card-types";

interface LeadSiteCardProps {
  leadId: string;
}

/**
 * Format `Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })`
 * Ex: "9 de maio de 2026" (AC5).
 */
function formatLongDatePtBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(parsed);
}

function statusLabel(status: LeadSiteStatus): string {
  switch (status) {
    case "draft":
      return "Rascunho";
    case "published":
      return "Publicado";
    case "sent":
      return "Enviado";
    case "archived":
      return "Arquivado";
  }
}

/**
 * Server Component principal. Faz fetch e delega render.
 */
export async function LeadSiteCard({ leadId }: LeadSiteCardProps) {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("lead_sites")
    .select(
      "id, slug, status, generated_at, published_at, sent_at, view_count, variables",
    )
    .eq("lead_id", leadId)
    .maybeSingle();

  // Em caso de erro de fetch (RLS bloqueando, etc), tratamos como
  // "sem site" — o usuário ainda pode tentar gerar. O log estruturado
  // pega o detalhe.
  if (error) {
    console.error("LeadSiteCard.fetch", {
      action: "LeadSiteCard.fetch",
      leadId,
      errorName: error.name ?? "unknown",
      errorMessage: error.message ?? "",
    });
  }

  // Cast: supabase devolve `variables: Json`. O Server Component só passa
  // adiante; o consumidor (modal #168) re-valida via `SiteVariables.partial()`
  // antes de enviar de volta pro Server Action.
  const leadSite: LeadSiteCardData | null =
    (data as LeadSiteCardData | null) ?? null;

  return (
    <LeadSiteCardView
      leadId={leadId}
      leadSite={leadSite}
      appUrl={publicEnv.NEXT_PUBLIC_APP_URL}
    />
  );
}

// ---------------------------------------------------------------------------
// View pura — separada pra facilitar testes (Server Components não têm um
// runtime síncrono em jsdom; testamos a view com props prontos).
// ---------------------------------------------------------------------------

interface LeadSiteCardViewProps {
  leadId: string;
  leadSite: LeadSiteCardData | null;
  appUrl: string;
}

export function LeadSiteCardView({
  leadId,
  leadSite,
  appUrl,
}: LeadSiteCardViewProps) {
  const status: LeadSiteStatus | "none" = leadSite?.status ?? "none";

  // Estado `none` ou `draft` — CTA único de geração.
  if (status === "none" || status === "draft") {
    return (
      <Card
        role="region"
        aria-label="Site do lead"
        data-testid="lead-site-card"
        data-state="none"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileX className="size-4 text-muted-foreground" aria-hidden="true" />
            Site do lead
          </CardTitle>
          <CardDescription>
            Nenhum site gerado ainda. Use o botão abaixo para criar uma
            página personalizada com IA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadSiteCardActions
            leadSite={leadSite}
            leadId={leadId}
            appUrl={appUrl}
          />
        </CardContent>
      </Card>
    );
  }

  // Estado `archived`
  if (status === "archived") {
    const archivedAt = formatLongDatePtBr(
      leadSite?.published_at ?? leadSite?.generated_at ?? null,
    );
    return (
      <Card
        role="region"
        aria-label="Site do lead"
        data-testid="lead-site-card"
        data-state="archived"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileX className="size-4 text-muted-foreground" aria-hidden="true" />
            Site arquivado
          </CardTitle>
          <CardDescription>
            Site arquivado em {archivedAt}. Restaure para reabrir o link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadSiteCardActions
            leadSite={leadSite}
            leadId={leadId}
            appUrl={appUrl}
          />
        </CardContent>
      </Card>
    );
  }

  // Estados `published` / `sent`
  const generatedAt = formatLongDatePtBr(
    leadSite?.generated_at ?? leadSite?.published_at ?? null,
  );
  const sentAt = formatLongDatePtBr(leadSite?.sent_at ?? null);
  const slug = leadSite?.slug ?? "";
  const url = `${appUrl}/sites/${slug}`;
  const isSent = status === "sent";

  return (
    <Card
      role="region"
      aria-label="Site do lead"
      data-testid="lead-site-card"
      data-state={isSent ? "sent" : "published"}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2
            className="size-4 text-emerald-500"
            aria-hidden="true"
          />
          Site gerado em {generatedAt}
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{statusLabel(leadSite!.status)}</Badge>
          {isSent ? (
            <Badge
              variant="outline"
              className="gap-1"
              data-testid="lead-site-sent-badge"
            >
              <Mail className="size-3" aria-hidden="true" />
              Enviado em {sentAt}
            </Badge>
          ) : null}
          {isSent ? (
            <Badge
              variant="outline"
              className="gap-1"
              data-testid="lead-site-views-badge"
            >
              <MapPin className="size-3" aria-hidden="true" />
              {leadSite!.view_count}{" "}
              {leadSite!.view_count === 1 ? "visualização" : "visualizações"}
            </Badge>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs break-all">
          <span className="sr-only">URL do site:</span>
          {url}
        </div>
        <LeadSiteCardActions
          leadSite={leadSite}
          leadId={leadId}
          appUrl={appUrl}
        />
      </CardContent>
    </Card>
  );
}
