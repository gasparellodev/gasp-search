/**
 * `<LeadSiteCardView />` — view pura do `<LeadSiteCard />` (issue #167).
 *
 * Extraído de `lead-site-card.tsx` (Server Component) pra permitir reuso
 * dentro de `lead-site-card-client.tsx` (Client Component) sem arrastar
 * a importação `'server-only'` para o bundle do cliente.
 *
 * **Não tem `'use client'` nem `'server-only'`** — é renderizável em
 * qualquer boundary. Recebe dados prontos via props.
 */

import { CheckCircle2, FileX, Mail, MapPin } from "lucide-react";

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
            <FileX
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
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
            <FileX
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
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
