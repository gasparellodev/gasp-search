/**
 * Tipos compartilhados entre `<LeadSiteCard />` (Server Component) e
 * `<LeadSiteCardActions />` (Client Component).
 *
 * Mantemos só o subset de campos que a UI consome — passar a `Row`
 * inteira do Supabase pra Client Component vazaria detalhes de banco
 * (e.g. `user_id`) sem necessidade.
 */

import type { Database } from "@/types/database";

export type LeadSiteStatus = Database["public"]["Enums"]["lead_site_status"];

export interface LeadSiteCardData {
  id: string;
  slug: string;
  status: LeadSiteStatus;
  /** ISO string. Server Component preserva como string pra evitar
   *  serialization issues entre boundary. */
  generated_at: string | null;
  published_at: string | null;
  sent_at: string | null;
  view_count: number;
}
