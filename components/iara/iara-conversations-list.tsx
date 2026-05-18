"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SandboxLeadOption {
  id: string;
  business_name: string;
  city: string | null;
  hasConversation: boolean;
}

interface IaraConversationsListProps {
  leads: SandboxLeadOption[];
  selectedLeadId: string | null;
  basePath?: string;
}

export function IaraConversationsList({
  leads,
  selectedLeadId,
  basePath = "/admin/iara/sandbox",
}: IaraConversationsListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => {
      const haystack = `${l.business_name} ${l.city ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [leads, query]);

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col gap-3 border-r"
      aria-label="Lista de leads"
    >
      <div className="px-3 pt-3">
        <h2 className="sk-h4 mb-2">Leads</h2>
        <div className="relative">
          <Search
            className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome / cidade"
            aria-label="Buscar lead"
            className="pl-8"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground p-3 text-sm">
            Nenhum lead encontrado.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((lead) => {
              const active = lead.id === selectedLeadId;
              return (
                <li key={lead.id}>
                  <Link
                    href={`${basePath}?leadId=${lead.id}`}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted",
                    )}
                    aria-current={active ? "page" : undefined}
                    data-testid={`lead-list-item-${lead.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {lead.business_name}
                      </div>
                      {lead.city ? (
                        <div className="text-muted-foreground truncate text-xs">
                          {lead.city}
                        </div>
                      ) : null}
                    </div>
                    {lead.hasConversation ? (
                      <span
                        className="bg-primary mt-1 inline-block size-1.5 shrink-0 rounded-full"
                        aria-label="Já tem conversa Iara"
                        title="Já tem conversa Iara"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

export default IaraConversationsList;
