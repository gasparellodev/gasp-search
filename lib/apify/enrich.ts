import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApifyClient } from "apify-client";
import { env } from "@/lib/env";
import { normalizeWebsite } from "@/lib/apify/google-maps";
import type { Database, Tables } from "@/types/database";

/**
 * Shape parcial do output do actor `vdrmota~contact-info-scraper`. Há mais
 * campos (linkedIns, instagrams, twitters, etc.) que vão para `raw` quando
 * desejado, mas para enrich só consumimos email/phone/whatsapp.
 */
export interface WebsiteContactItem {
  url?: string | null;
  emails?: string[] | null;
  phones?: string[] | null;
  whatsapps?: string[] | null;
  phonesUncertain?: string[] | null;
  linkedIns?: string[] | null;
  instagrams?: string[] | null;
}

export interface EnrichmentMapResult {
  url: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
}

/**
 * Mapeia um item do dataset do website-contact-scraper para um shape
 * achatado e normalizado. URL é normalizada para a forma canônica usada
 * em `leads.website`.
 */
export function mapWebsiteContact(
  item: WebsiteContactItem,
): EnrichmentMapResult {
  const url = normalizeWebsite(item.url ?? null);
  const email = pickFirst(item.emails);
  const phone = pickFirst(item.phones);
  const whatsapp = pickFirst(item.whatsapps);
  return { url, email, phone, whatsapp };
}

function pickFirst(list: string[] | null | undefined): string | null {
  if (!list || list.length === 0) return null;
  const first = list[0]?.trim();
  return first && first.length > 0 ? first : null;
}

export interface EnrichLeadsResult {
  enrichedCount: number;
  enrichedLeadIds: string[];
  skippedUrls: string[];
}

/**
 * Roda o actor de enrich nos URLs dados, encontra os leads do user que
 * batem com cada URL (via `website` normalizado) e atualiza com os
 * contatos extraídos. **Não cria lead novo** — apenas atualiza existentes.
 *
 * Empty result do actor não quebra: leads ficam intactos.
 */
export async function enrichLeadsByUrls({
  supabase,
  userId: _userId,
  urls,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  urls: string[];
}): Promise<EnrichLeadsResult> {
  void _userId; // RLS já filtra por user; recebemos por simetria com outras funções

  const normalizedUrls = Array.from(
    new Set(urls.map((url) => normalizeWebsite(url)).filter(
      (value): value is string => value !== null,
    )),
  );
  if (normalizedUrls.length === 0) {
    return { enrichedCount: 0, enrichedLeadIds: [], skippedUrls: [] };
  }

  const startUrls = normalizedUrls.map((url) => ({ url: `https://${url}` }));

  let datasetId: string;
  try {
    const apify = new ApifyClient({ token: env.APIFY_TOKEN });
    const run = await apify
      .actor(env.APIFY_WEBSITE_CONTACT_ACTOR_ID)
      .call({ startUrls });
    datasetId = run.defaultDatasetId;
  } catch (error) {
    throw new Error(
      `Falha ao executar enrich: ${
        error instanceof Error ? error.message : "desconhecido"
      }`,
    );
  }

  const apify = new ApifyClient({ token: env.APIFY_TOKEN });
  const { items } = await apify
    .dataset(datasetId)
    .listItems();

  // Intentional cast: `apify-client.dataset(id).listItems()` retorna
  // `PaginatedList<Record<string, unknown>>` — `apify-client` v2 não suporta
  // generics no `listItems()`. O cast aqui é o boundary onde tratamos o
  // payload externo do actor `vdrmota~contact-info-scraper` como o shape
  // `WebsiteContactItem`. Runtime guard é feito por `mapWebsiteContact`
  // (lê apenas campos esperados com `?? null`) e por `normalizeWebsite`
  // (rejeita URLs malformadas) — qualquer campo extra do actor é ignorado.
  const itemList = items as unknown as WebsiteContactItem[];

  // Index dos leads do user pelos websites normalizados que importam.
  const { data: leadRows, error: leadsError } = await supabase
    .from("leads")
    .select("id, website")
    .in("website", normalizedUrls);

  if (leadsError) {
    throw new Error(
      `Falha ao executar enrich: ${leadsError.message}`,
    );
  }

  const leadByUrl = new Map<string, string>();
  for (const row of (leadRows ?? []) as Array<
    Pick<Tables<"leads">, "id" | "website">
  >) {
    if (row.website) leadByUrl.set(row.website, row.id);
  }

  const enrichedLeadIds: string[] = [];
  const skippedUrls = new Set<string>(normalizedUrls);

  for (const item of itemList) {
    const result = mapWebsiteContact(item);
    if (!result.url) continue;

    const leadId = leadByUrl.get(result.url);
    if (!leadId) continue;

    const update: Partial<Tables<"leads">> = {};
    if (result.email) update.email = result.email;
    if (result.phone) update.phone = result.phone;
    if (result.whatsapp) update.whatsapp = result.whatsapp;
    if (Object.keys(update).length === 0) continue;

    update.enriched_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("leads")
      .update(update)
      .eq("id", leadId);

    if (updateError) continue;

    enrichedLeadIds.push(leadId);
    skippedUrls.delete(result.url);
  }

  return {
    enrichedCount: enrichedLeadIds.length,
    enrichedLeadIds,
    skippedUrls: [...skippedUrls],
  };
}
