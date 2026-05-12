"use client";

/**
 * `<LeadDetailDrawer />` — wrapper Sheet sobre `<LeadTabs mode="inline">`.
 *
 * Após issue #136 a UI canônica de tabs vive em `<LeadTabs />`, reutilizada
 * tanto aqui (inline em um Sheet) quanto na rota standalone
 * `/leads/[id]/page.tsx`. Este componente fica responsável só pelo
 * wrapper Sheet (header, footer, sizing responsivo) e por passar o
 * `<LeadSiteCardClient />` como slot pra tab "Site".
 */

import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LeadTabs } from "@/components/leads/lead-tabs";
import { publicEnv } from "@/lib/env-public";
import type { LeadListItem, LeadTagSummary } from "@/lib/leads/list-leads";

import { LeadSiteCardClient } from "./lead-site-card-client";

interface LeadDetailDrawerProps {
  lead: LeadListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: LeadTagSummary[];
}

export function LeadDetailDrawer({
  lead,
  open,
  onOpenChange,
  tags,
}: LeadDetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-[min(100vw,60rem)] max-w-full flex-col gap-0 data-[side=right]:sm:max-w-2xl data-[side=right]:md:max-w-3xl data-[side=right]:lg:max-w-4xl data-[side=right]:xl:max-w-5xl"
      >
        {lead ? <DrawerBody key={lead.id} lead={lead} tags={tags} /> : null}
      </SheetContent>
    </Sheet>
  );
}

interface DrawerBodyProps {
  lead: LeadListItem;
  tags: LeadTagSummary[];
}

function DrawerBody({ lead, tags }: DrawerBodyProps) {
  const whatsappEnabled = publicEnv.NEXT_PUBLIC_WHATSAPP_ENABLED === "1";
  const showWhatsappLink = whatsappEnabled && Boolean(lead.phone);
  return (
    <>
      <SheetHeader className="border-b px-4 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <SheetTitle className="break-words text-xl font-semibold">
            {lead.name}
          </SheetTitle>
          {showWhatsappLink ? (
            <Button
              asChild
              variant="ghost"
              size="icon"
              aria-label={`Abrir conversa de ${lead.name}`}
              title="Abrir conversa"
              className="shrink-0"
            >
              <Link href={`/messages/${lead.id}`}>
                <MessageCircle className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>
        <SheetDescription className="text-muted-foreground text-xs">
          Editar nome, telefone, stage, score, notas e tags. Mudanças
          persistem imediatamente via PATCH.
        </SheetDescription>
      </SheetHeader>

      <LeadTabs
        lead={lead}
        mode="inline"
        tags={tags}
        siteCard={<LeadSiteCardClient leadId={lead.id} />}
      />

      <SheetFooter className="border-t px-4 py-4 sm:px-6">
        <SheetClose asChild>
          <Button variant="outline" className="w-full">
            Fechar
          </Button>
        </SheetClose>
      </SheetFooter>
    </>
  );
}
