"use client";

/**
 * `<LeadSiteCardClient />` — Client wrapper do `<LeadSiteCardView />` usado
 * dentro do `<LeadDetailDrawer />` (que é client-only).
 *
 * O `<LeadSiteCard />` original (#167) é Server Component e busca direto
 * via Supabase. Como Server Components não podem ser importados em Client
 * Components, este wrapper:
 *   1. Chama Server Action `getLeadSiteCardData(leadId)` em `useEffect`.
 *   2. Mostra skeleton enquanto carrega.
 *   3. Renderiza `<LeadSiteCardView>` quando data chega.
 *
 * Re-fetch quando `leadId` muda (drawer reabre pra outro lead).
 */

import { useEffect, useState } from "react";

import { getLeadSiteCardData } from "@/app/actions/lead-site";
import { Skeleton } from "@/components/ui/skeleton";

import { LeadSiteCardView } from "./lead-site-card-view";
import type { LeadSiteCardData } from "./lead-site-card-types";

interface LeadSiteCardClientProps {
  leadId: string;
}

interface LoadedState {
  leadSite: LeadSiteCardData | null;
  appUrl: string;
}

export function LeadSiteCardClient({ leadId }: LeadSiteCardClientProps) {
  const [state, setState] = useState<LoadedState | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await getLeadSiteCardData(leadId);
      if (cancelled) return;
      setState({
        leadSite: (result.leadSite as LeadSiteCardData | null) ?? null,
        appUrl: result.appUrl,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (state === null) {
    return (
      <div className="space-y-3" data-testid="lead-site-card-skeleton">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  return (
    <LeadSiteCardView
      leadId={leadId}
      leadSite={state.leadSite}
      appUrl={state.appUrl}
    />
  );
}
