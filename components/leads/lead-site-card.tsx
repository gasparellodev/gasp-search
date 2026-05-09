/**
 * `<LeadSiteCard />` — Server Component (issue #167).
 *
 * Render do bloco "Site do lead" na ficha `/leads/[id]`. Busca o
 * `lead_sites` row via Supabase (RLS isola por `user_id`) e delega
 * ações pra `<LeadSiteCardActions />` (client) via `<LeadSiteCardView />`
 * (puro, em arquivo separado).
 *
 * **Server boundary:** este arquivo importa `'server-only'` via
 * `lib/supabase/server`. Não pode ser importado de Client Component —
 * use `<LeadSiteCardClient />` no drawer ou `<LeadSiteCardView />`
 * direto se a data já vier por prop.
 */

import { publicEnv } from "@/lib/env-public";
import { createServerSupabase } from "@/lib/supabase/server";

import { LeadSiteCardView } from "./lead-site-card-view";
import type { LeadSiteCardData } from "./lead-site-card-types";

interface LeadSiteCardProps {
  leadId: string;
}

/**
 * Server Component principal. Faz fetch e delega render à view pura.
 */
export async function LeadSiteCard({ leadId }: LeadSiteCardProps) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.warn("[LeadSiteCard] DEBUG", {
    leadId,
    authUid: user?.id ?? null,
  });

  const { data, error } = await supabase
    .from("lead_sites")
    .select(
      "id, slug, status, generated_at, published_at, sent_at, view_count, variables",
    )
    .eq("lead_id", leadId)
    .maybeSingle();

  console.warn("[LeadSiteCard] DEBUG result", {
    leadId,
    foundRow: data !== null,
    rowStatus: (data as { status?: string } | null)?.status ?? null,
    errorMessage: error?.message ?? null,
  });

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

// Re-export pra compat com testes que importam direto de `lead-site-card`.
export { LeadSiteCardView } from "./lead-site-card-view";
