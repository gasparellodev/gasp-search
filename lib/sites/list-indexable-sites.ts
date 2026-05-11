/**
 * `listIndexableSites()` — lista sites indexáveis para o sitemap.xml.
 *
 * Issue #212 / Sprint 1 / #S2 — SEO infra fundamental.
 *
 * **Por que helper novo (não reusa `getSite`)?**
 *   `getSite` usa `'use cache'` directive (Next 16 Cache Components) com
 *   `cacheTag(\`site:\${slug}\`)`. Tentar reusar em `Promise.all(slugs.map(getSite))`
 *   cachearia N entries individuais com TTL diferente do controlado pelo
 *   sitemap. Aqui o sitemap controla cache via `export const revalidate = 3600`
 *   na rota — então este helper roda direto contra Supabase sem cache wrapper.
 *
 * **Service-role intencional.** A rota `/sitemap.xml` é pública (search
 * engines acessam sem cookies), sem `auth.uid()`. Service-role bypassa RLS
 * porque o filtro de visibilidade é puramente o gate `isIndexable`
 * (não isolation por user). Confinado a `lib/supabase/service.ts`.
 *
 * **Defense in depth.** Filtro SQL (`.in('status', ['published','sent'])`
 * + `.not('signed_at', 'is', null)`) é redundante com `.filter(isIndexable)`
 * em JS. Razão: se algum dia um novo status (e.g. `pending`) for adicionado
 * sem atualizar este SQL, o gate canônico de `metadata.ts` continua
 * sendo a source-of-truth — drift defendido.
 *
 * **Graceful degradation.** Em DB error, retorna `[]` + `console.error`.
 * Sitemap vira lista vazia (válido per Sitemaps Protocol) em vez de
 * derrubar o crawl com 500.
 */
import "server-only";

import { isIndexable } from "@/lib/sites/metadata";
import { createServiceSupabase } from "@/lib/supabase/service";

/**
 * Subset persistido em `lead_sites` que o sitemap consome.
 * `variables: unknown` — caller (sitemap.ts) faz `SiteVariablesV2.safeParse`
 * antes de extrair `cars[]` etc.
 */
export interface IndexableSiteRow {
  slug: string;
  variables: unknown;
  updated_at: string;
  signed_at: string;
  status: "published" | "sent";
}

/**
 * Lista todos os sites que devem aparecer no sitemap.xml.
 *
 * Filtro: `status IN ('published','sent') AND signed_at IS NOT NULL`
 * (alinhado com `isIndexable` em `lib/sites/metadata.ts`).
 *
 * @returns array de sites; `[]` em caso de erro ou nenhuma row.
 */
export async function listIndexableSites(): Promise<IndexableSiteRow[]> {
  try {
    const supa = createServiceSupabase();
    const { data, error } = await supa
      .from("lead_sites")
      .select("slug, variables, updated_at, signed_at, status")
      .in("status", ["published", "sent"])
      .not("signed_at", "is", null);

    if (error) {
      console.error("listIndexableSites: Supabase query failed", error);
      return [];
    }
    if (!data) return [];

    // Defense in depth: filtra novamente pelo gate canônico.
    // Mesmo que o SQL acima driftem do contract de `isIndexable`, o gate
    // do `metadata.ts` permanece a source-of-truth.
    const result: IndexableSiteRow[] = [];
    for (const row of data) {
      if (row === null || typeof row !== "object") continue;
      const status = (row as { status: string }).status;
      const signedAt = (row as { signed_at: string | null }).signed_at;
      if (!isIndexable({ status, signed_at: signedAt ?? null })) continue;
      if (signedAt === null) continue; // narrowing pro IndexableSiteRow

      result.push({
        slug: (row as { slug: string }).slug,
        variables: (row as { variables: unknown }).variables,
        updated_at: (row as { updated_at: string }).updated_at,
        signed_at: signedAt,
        status: status as "published" | "sent",
      });
    }
    return result;
  } catch (err) {
    console.error("listIndexableSites: unexpected error", err);
    return [];
  }
}
