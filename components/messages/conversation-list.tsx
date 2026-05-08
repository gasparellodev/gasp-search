"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createBrowserSupabase } from "@/lib/supabase/client";
import type { ConversationItem } from "@/lib/messages/list-conversations";

type Props = {
  initial: ConversationItem[];
  selectedLeadId: string | null;
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

export function ConversationList({ initial, selectedLeadId }: Props) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  // Realtime: ao chegar/sair UPDATE/INSERT em lead_messages, invalidamos
  // a rota para o Server Component recalcular o agregado.
  // initialRef evita capturar `initial` no callback (que muda a cada navegação).
  const initialRef = useRef(initial);
  useEffect(() => {
    initialRef.current = initial;
  }, [initial]);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel("lead_messages:list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_messages" },
        () => {
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const filtered = useMemo(() => {
    if (!query) return initial;
    const q = query.toLowerCase();
    return initial.filter((c) => c.leadName.toLowerCase().includes(q));
  }, [initial, query]);

  const conversations = initial;

  return (
    <aside
      className="flex h-full w-full max-w-sm flex-col border-r"
      data-testid="conversation-list"
    >
      <div className="border-b p-3">
        <Input
          placeholder="Buscar conversa..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {conversations.length === 0
              ? "Nenhuma conversa ainda. Mensagens aparecem aqui depois do primeiro envio ou recebimento."
              : "Nenhuma conversa bate com a busca."}
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((c) => {
              const active = c.leadId === selectedLeadId;
              return (
                <li key={c.leadId}>
                  <Link
                    href={`/messages/${c.leadId}`}
                    className={cn(
                      "block p-3 transition-colors hover:bg-accent",
                      active && "bg-accent",
                    )}
                    data-testid={`conversation-item-${c.leadId}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{c.leadName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatTime(c.lastCreatedAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {c.lastDirection === "outbound" ? (
                        c.lastStatus === "read" ? (
                          <CheckCheck className="size-3 text-blue-500" />
                        ) : c.lastStatus === "delivered" ? (
                          <CheckCheck className="size-3" />
                        ) : c.lastStatus === "queued" ? (
                          <Clock className="size-3" />
                        ) : null
                      ) : null}
                      <span className="truncate">{c.lastContent}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}
