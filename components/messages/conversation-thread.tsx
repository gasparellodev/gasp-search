"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck, Clock, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { createBrowserSupabase } from "@/lib/supabase/client";
import type { LeadMessage } from "@/lib/ai/messages";

type Props = {
  leadId: string;
};

type Presence = "typing" | "paused" | "online" | "offline";

type PresenceSnapshot = {
  presence: Presence;
  lastSeen: string | null;
};

function presenceText(snapshot: PresenceSnapshot | null): string | null {
  if (!snapshot) return null;
  if (snapshot.presence === "typing") return "digitando...";
  if (snapshot.presence === "online") return "Online agora";
  if (snapshot.lastSeen) {
    const diffMs = Date.now() - new Date(snapshot.lastSeen).getTime();
    const minutes = Math.max(1, Math.floor(diffMs / 60_000));
    if (minutes < 60) return `Visto há ${minutes}min`;
  }
  if (snapshot.presence === "paused") return "Visto recentemente";
  return "Offline";
}

function StatusIcon({ status }: { status: LeadMessage["status"] }) {
  switch (status) {
    case "queued":
      return (
        <Clock
          className="size-3 text-muted-foreground"
          data-testid="status-icon"
        />
      );
    case "sent":
      return <CheckCheck className="size-3" data-testid="status-icon" />;
    case "delivered":
      return (
        <CheckCheck className="size-3" data-testid="status-icon" />
      );
    case "read":
      return (
        <CheckCheck
          className="size-3 text-sky-500 dark:text-sky-400"
          data-testid="status-icon"
        />
      );
    case "failed":
      return (
        <TriangleAlert
          className="size-3 text-destructive"
          data-testid="status-icon"
        />
      );
    default:
      return null;
  }
}

export function ConversationThread({ leadId }: Props) {
  const [messages, setMessages] = useState<LeadMessage[] | null>(null);
  const [presence, setPresence] = useState<PresenceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Carregamento inicial + Realtime.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/messages?leadId=${encodeURIComponent(leadId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("falha");
        const body = (await res.json()) as { messages: LeadMessage[] };
        if (active) {
          // API retorna desc; thread mostra cronológico (asc).
          setMessages([...body.messages].reverse());
          setError(null);
        }
      } catch {
        if (active) setError("Falha ao carregar conversa.");
      }
    };
    const loadPresence = async () => {
      try {
        const res = await fetch(
          `/api/whatsapp/presence/${encodeURIComponent(leadId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const body = (await res.json()) as PresenceSnapshot;
        if (active) setPresence(body);
      } catch {
        // Presença é volátil; falha não bloqueia o histórico da conversa.
      }
    };
    void load();
    void loadPresence();

    const supabase = createBrowserSupabase();
    const messagesChannel = supabase
      .channel(`lead_messages:thread:${leadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lead_messages",
          filter: `lead_id=eq.${leadId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();
    const presenceChannel = supabase
      .channel(`whatsapp-presence:${leadId}`)
      .on(
        "broadcast",
        { event: "presence" },
        (payload: { payload?: Partial<PresenceSnapshot> & { leadId?: string } }) => {
          const next = payload.payload;
          if (!next || next.leadId !== leadId) return;
          if (
            next.presence !== "typing" &&
            next.presence !== "paused" &&
            next.presence !== "online" &&
            next.presence !== "offline"
          ) {
            return;
          }
          setPresence({
            presence: next.presence,
            lastSeen: typeof next.lastSeen === "string" ? next.lastSeen : null,
          });
        },
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(messagesChannel);
      void supabase.removeChannel(presenceChannel);
    };
  }, [leadId]);

  // Auto-scroll ao receber novas mensagens.
  useEffect(() => {
    if (messages && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!messages) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="ml-auto h-10 w-1/2" />
        <Skeleton className="h-10 w-3/5" />
        <Skeleton className="ml-auto h-10 w-2/5" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Nenhuma mensagem ainda. Use o composer abaixo para enviar a primeira.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full" data-testid="conversation-thread">
      <div className="flex flex-col gap-2 p-4">
        {presenceText(presence) ? (
          <div
            className="self-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
            data-testid="conversation-presence"
          >
            {presenceText(presence)}
          </div>
        ) : null}
        {messages.map((m) => {
          const out = m.direction === "outbound";
          return (
            <div
              key={m.id}
              className={cn("flex", out ? "justify-end" : "justify-start")}
              data-testid={`bubble-${m.direction}`}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-[var(--sk-card-radius)] px-4 py-2 text-sm shadow-sm",
                  out
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-card-foreground",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <div
                  className={cn(
                    "mt-1 flex items-center justify-end gap-1 text-xs",
                    out
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground",
                  )}
                >
                  <span>
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {out ? <StatusIcon status={m.status} /> : null}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
