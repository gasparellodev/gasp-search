/**
 * `getSite(slug)` — leitura cacheada de `lead_sites` por slug global único.
 *
 * Fonte canônica: §8 do spec mestre
 * (`docs/superpowers/specs/2026-05-08-gerador-sites-concessionarias-design.md`).
 *
 * Originalmente vivia inline em `app/sites/[slug]/page.tsx` (issue #160).
 * Extraído pra cá em #163 para ser reutilizado pelas sub-rotas
 * `/sites/[slug]/sobre`, `/contato`, `/anunciar` (e #164/#165 quando
 * `estoque`/`carro` chegarem). O comportamento é **idêntico** ao
 * original — qualquer divergência é regression.
 *
 * **Cache directives Next 16 (Cache Components):**
 *   - `'use cache'` — função inteira é cacheada por args.
 *   - `cacheTag(\`site:\${slug}\`)` — invalidação targeted via
 *     `updateTag('site:<slug>')` em `app/actions/lead-site.ts` (M1.7).
 *   - `cacheLife({ revalidate: 3600, expire: 86400 })` — SWR 1h, expire 24h.
 *
 * **Service-role intencional.** A leitura é pública (sem `auth.uid()`),
 * single-purpose (read-only por slug global único, indexed unique), e o
 * client com `SUPABASE_SERVICE_ROLE_KEY` fica confinado a
 * `lib/supabase/service.ts`. Allowlist enforced via grep no
 * `app/sites/CLAUDE.md`.
 *
 * **Error swallowing intencional.** Quando o Supabase retorna `error`
 * (connection refused, RLS, etc.), retornamos `null` em vez de levantar.
 * O caller decide via `notFound()` se vai 404. Isso evita vazar erro
 * cru pro client e mantém a página resiliente — site novo num minuto
 * de instabilidade do banco vira 404 temporário, não crash.
 */
import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { createServiceSupabase } from "@/lib/supabase/service";

export interface SiteRow {
  id: string;
  slug: string;
  status: "draft" | "published" | "sent" | "archived";
  /** Validar via `SiteVariables.safeParse` antes do render. */
  variables: unknown;
  /**
   * Momento de assinatura do contrato pelo cliente (issue #199, migration
   * 0018). `null` até confirmação manual via admin. Habilita o gate
   * `isIndexable(site)` em `lib/sites/metadata.ts` que controla
   * `robots.index` nas 6 rotas `/sites/[slug]/*`. Distinto de
   * `published_at` (publicação técnica) e `sent_at` (envio do preview).
   */
  signed_at: string | null;
}

export async function getSite(slug: string): Promise<SiteRow | null> {
  "use cache";
  cacheTag(`site:${slug}`);
  cacheLife({ revalidate: 3600, expire: 86400 });

  const supa = createServiceSupabase();
  const { data, error } = await supa
    .from("lead_sites")
    .select("id, slug, status, variables, signed_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as SiteRow;
}
