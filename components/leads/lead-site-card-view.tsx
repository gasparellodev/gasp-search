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

import { AlertTriangle, CheckCircle2, FileX, Mail, MapPin } from "lucide-react";

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
import type { PreGenLeadSummary } from "./lead-site-pre-gen-modal";

/**
 * Extrai a frase amigável (`message`) do JSON serializado em
 * `lead_sites.generation_error`. Caller passa a string raw; em caso de
 * parse failure (ou shape inesperado) cai pra fallback genérico.
 *
 * O JSON tem shape `{ code, message, timestamp }` (até 4KB) escrito por
 * `serializeGenerationError` em `app/actions/lead-site.ts`. Aceita também
 * payloads texto puro (defesa contra rows legadas).
 */
function readGenerationErrorMessage(raw: string | null): string {
  if (!raw) return "Erro desconhecido.";
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "message" in parsed &&
      typeof (parsed as { message: unknown }).message === "string"
    ) {
      const msg = (parsed as { message: string }).message.trim();
      return msg.length > 0 ? msg : "Erro desconhecido.";
    }
  } catch {
    // Texto cru, não JSON — usa direto.
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : "Erro desconhecido.";
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

interface LeadSiteCardViewProps {
  leadId: string;
  leadSite: LeadSiteCardData | null;
  appUrl: string;
  /** Sprint A1: forward pra `<LeadSiteCardActions>`. Quando ausente,
   *  o modal de validação não aparece (fallback compatível). */
  leadSummary?: PreGenLeadSummary | null;
}

export function LeadSiteCardView({
  leadId,
  leadSite,
  appUrl,
  leadSummary,
}: LeadSiteCardViewProps) {
  const status: LeadSiteStatus | "none" = leadSite?.status ?? "none";
  const hasGenerationError =
    status === "draft" && leadSite?.generation_error != null;

  // Estado `draft` + `generation_error` — geração quebrou e precisa de
  // recovery (sprint A4 onsite flow). Mostra erro PT-BR + botão "Descartar
  // rascunho" via `<LeadSiteCardActions>` (que detecta o mesmo flag).
  if (hasGenerationError) {
    const errorMessage = readGenerationErrorMessage(
      leadSite?.generation_error ?? null,
    );
    return (
      <Card
        role="region"
        aria-label="Site do lead"
        data-testid="lead-site-card"
        data-state="draft-error"
        className="border-destructive/40"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle
              className="size-4 text-destructive"
              aria-hidden="true"
            />
            Geração do site falhou
          </CardTitle>
          <CardDescription
            className="break-words"
            data-testid="lead-site-error-message"
          >
            <span className="text-foreground">Motivo:</span> {errorMessage}
            {" "}
            Descarte este rascunho e tente novamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadSiteCardActions
            leadSite={leadSite}
            leadId={leadId}
            appUrl={appUrl}
            leadSummary={leadSummary ?? null}
          />
        </CardContent>
      </Card>
    );
  }

  // Estado `none` ou `draft` limpo (sem erro) — CTA único de geração.
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
            leadSummary={leadSummary ?? null}
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
            leadSummary={leadSummary ?? null}
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
          leadSummary={leadSummary ?? null}
        />
      </CardContent>
    </Card>
  );
}
