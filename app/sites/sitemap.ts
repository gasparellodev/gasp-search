/**
 * `app/sites/sitemap.ts` — Sitemap global de todos os mini-sites publicados.
 *
 * Issue #S1 / Frente 03 SEO Infra.
 *
 * Lista todos os leads com `status IN ('published', 'sent')` E `signed_at IS NOT NULL`
 * — mesmo gate de `isIndexable` usado em `app/sites/[slug]/llms.txt` (#214).
 *
 * Cache: `revalidate = 3600`. Invalidação propaga via `cacheTag('sitemap:sites')`
 * acionado nas Server Actions de publish/archive/unpublish em
 * `app/actions/lead-site.ts` (a integração do `updateTag` é fora-de-escopo desta
 * task e fica como follow-up).
 *
 * Quotas: Next aceita até 50k URLs por sitemap. Em volumes > 1000 leads,
 * migrar para sitemap index pattern (issue futura).
 */
import "server-only";

import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { createServiceSupabase } from "@/lib/supabase/service";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("lead_sites")
    .select("slug, updated_at")
    .in("status", ["published", "sent"])
    .not("signed_at", "is", null)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    url: `${env.NEXT_PUBLIC_APP_URL}/sites/${row.slug}`,
    lastModified: new Date(row.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
}
