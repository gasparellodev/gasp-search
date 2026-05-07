"use client";

import Link from "next/link";
import { Copy, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LeadMessage } from "@/lib/ai/messages";

interface MessageHistoryProps {
  leadId: string;
  messages: LeadMessage[];
  page: number;
  totalPages: number;
  totalCount: number;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function pageHref(leadId: string, page: number): string {
  return `/leads/${leadId}?messagesPage=${page}`;
}

export function MessageHistory({
  leadId,
  messages,
  page,
  totalPages,
  totalCount,
}: MessageHistoryProps) {
  async function copy(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  const summary =
    totalCount === 1 ? "1 mensagem" : `${totalCount} mensagens`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de mensagens IA</CardTitle>
        <CardDescription>{summary} geradas para este lead.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {messages.length === 0 ? (
          <div className="border-border flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
            <Inbox className="text-muted-foreground size-6" />
            <p className="font-medium">Nenhuma mensagem gerada</p>
            <p className="text-muted-foreground text-sm">
              Use a aba Gerar para criar a primeira abordagem.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <article
                key={message.id}
                className="border-border rounded-lg border p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{message.channel}</Badge>
                    {message.tone ? (
                      <Badge variant="outline">{message.tone}</Badge>
                    ) : null}
                    <time className="text-muted-foreground text-xs">
                      {dateFormatter.format(new Date(message.created_at))}
                    </time>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copy(message.content)}
                  >
                    <Copy className="size-4" aria-hidden="true" />
                    Copiar mensagem
                  </Button>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {message.content}
                </p>
              </article>
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <nav
            className="flex items-center justify-between gap-3 pt-2"
            aria-label="Paginação de mensagens"
          >
            <Button asChild variant="outline" size="sm">
              <Link
                href={pageHref(leadId, Math.max(1, page - 1))}
                aria-disabled={page <= 1}
              >
                Anterior
              </Link>
            </Button>
            <span className="text-muted-foreground text-sm">
              Página {page} de {totalPages}
            </span>
            <Button asChild variant="outline" size="sm">
              <Link
                href={pageHref(leadId, Math.min(totalPages, page + 1))}
                aria-disabled={page >= totalPages}
              >
                Próxima
              </Link>
            </Button>
          </nav>
        ) : null}
      </CardContent>
    </Card>
  );
}
