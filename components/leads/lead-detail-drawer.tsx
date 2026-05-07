"use client";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { LeadListItem } from "@/lib/leads/list-leads";

interface LeadDetailDrawerProps {
  lead: LeadListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STAGE_LABEL: Record<LeadListItem["stage"], string> = {
  new: "Novo",
  contacted: "Contatado",
  in_conversation: "Em conversa",
  qualified: "Qualificado",
  closed_won: "Fechado (ganho)",
  closed_lost: "Fechado (perdido)",
};

function formatLocation(lead: LeadListItem): string | null {
  const parts = [lead.city, lead.state].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return parts.join(" / ");
}

export function LeadDetailDrawer({
  lead,
  open,
  onOpenChange,
}: LeadDetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 sm:max-w-md"
      >
        {lead ? (
          <>
            <SheetHeader className="border-b px-6 py-5">
              <SheetTitle className="text-xl font-semibold">
                {lead.name}
              </SheetTitle>
              <SheetDescription className="text-muted-foreground text-xs">
                Visão rápida do lead. Edição completa virá no próximo passo.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 text-sm">
              <section className="space-y-1">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Estágio
                </p>
                <Badge variant="secondary">{STAGE_LABEL[lead.stage]}</Badge>
              </section>

              {lead.category ? (
                <section className="space-y-1">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Categoria
                  </p>
                  <p>{lead.category}</p>
                </section>
              ) : null}

              {formatLocation(lead) ? (
                <section className="space-y-1">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Localização
                  </p>
                  <p>{formatLocation(lead)}</p>
                </section>
              ) : null}

              <Separator />

              <section className="space-y-2">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Contato
                </p>
                {lead.phone ? <p>{lead.phone}</p> : null}
                {lead.email ? <p>{lead.email}</p> : null}
                {lead.website ? <p>{lead.website}</p> : null}
                {lead.instagram_handle ? (
                  <p>@{lead.instagram_handle}</p>
                ) : null}
                {!lead.phone &&
                !lead.email &&
                !lead.website &&
                !lead.instagram_handle ? (
                  <p className="text-muted-foreground">
                    Nenhum contato cadastrado.
                  </p>
                ) : null}
              </section>

              {lead.tags.length > 0 ? (
                <>
                  <Separator />
                  <section className="space-y-2">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Tags
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {lead.tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          style={{ borderColor: tag.color, color: tag.color }}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}

              <Separator />

              <section className="space-y-1">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Score
                </p>
                <p>{lead.score}</p>
              </section>
            </div>

            <SheetFooter className="border-t px-6 py-4">
              <SheetClose asChild>
                <Button variant="outline" className="w-full">
                  Fechar
                </Button>
              </SheetClose>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
