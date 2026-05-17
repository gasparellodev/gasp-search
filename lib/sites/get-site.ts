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
import {
  VisualIdentityManifestSchema,
  type VisualIdentityManifest,
} from "@/types/visual-identity";

export interface SiteRow {
  id: string;
  slug: string;
  status: "draft" | "published" | "sent" | "archived";
  /** Validar via `SiteVariables.safeParse` antes do render. */
  variables: unknown;
  /**
   * Timestamp da última modificação da row `lead_sites` (gerenciado pelo
   * DB via trigger ou `DEFAULT now()`). Usado pelo sitemap per-site para
   * emitir `lastModified` real em vez de `Date.now()` — crítico para
   * freshnessSignals de crawl (ISR/GSC).
   */
  updated_at: string;
  /**
   * Rating Google da concessionária (lido de `leads.rating` via FK).
   * `null` quando o lead vem do Apify Instagram (sem reviews) ou Maps
   * sem avaliações públicas.
   *
   * **Sprint 4 / #H1 (issue #221)**: consumido por `<HomeTrustStrip>` via
   * props explícitas em `SitePage`. PO decision: NÃO estender
   * `SiteVariables` (evita migration); `getSite` faz select + relay.
   */
  lead_rating: number | null;
  /** Contagem de reviews Google (lida de `leads.reviews_count`). */
  lead_reviews_count: number | null;
  /**
   * Payload bruto do lead, usado best-effort por surfaces públicas que
   * precisam de metadados ainda não normalizados (ex.: placeId/lat/lng
   * do Google Maps em `/contato`). Nunca logar este valor.
   */
  lead_raw: unknown;
  /**
   * Momento de assinatura do contrato pelo cliente (issue #199, migration
   * 0018). `null` até confirmação manual via admin. Habilita o gate
   * `isIndexable(site)` em `lib/sites/metadata.ts` que controla
   * `robots.index` nas 6 rotas `/sites/[slug]/*`. Distinto de
   * `published_at` (publicação técnica) e `sent_at` (envio do preview).
   */
  signed_at: string | null;
  /**
   * Manifest de identidade visual AI persistido em `lead_sites.visual_identity`
   * (JSONB, migration 0019, issues #215/#216). `null` quando a action
   * `regenerateVisualIdentity` (#216) ainda não foi invocada para este
   * site OU quando o manifest persistido falhar em `VisualIdentityManifestSchema.safeParse`
   * (graceful degradation — caller cai em `brand_assets.*_image_url`).
   *
   * Sprint 2 / #A3 (issue #217): consumido pelos Server Components das
   * 3 sub-rotas públicas (`/sites/[slug]`, `/sobre`, `/contato`) e pelo
   * `opengraph-image.tsx` via fallback graceful
   * `manifest?.X_url ?? variables.brand_assets.X_image_url`.
   */
  visual_identity: VisualIdentityManifest | null;
}

export async function getSite(slug: string): Promise<SiteRow | null> {
  "use cache";
  cacheTag(`site:${slug}`);
  cacheLife({ revalidate: 3600, expire: 86400 });

  const supa = createServiceSupabase();
  const { data, error } = await supa
    .from("lead_sites")
    .select(
      "id, slug, status, variables, signed_at, updated_at, visual_identity, leads ( rating, reviews_count, raw )",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;

  // Defesa em profundidade: `visual_identity` é JSONB sem constraint de
  // shape no DB. Validamos via Zod; em parse fail caímos pra null
  // (consumer usa fallback `brand_assets.*_image_url`). NÃO logamos
  // o manifest cru — pode conter URLs que vazariam em observability.
  const rawManifest = (data as { visual_identity?: unknown }).visual_identity;
  let visualIdentity: VisualIdentityManifest | null = null;
  if (rawManifest != null) {
    const parsed = VisualIdentityManifestSchema.safeParse(rawManifest);
    if (parsed.success) {
      visualIdentity = parsed.data;
    } else {
      console.warn("getSite:visual_identity:parse_fail", {
        slug,
        issuePaths: parsed.error.issues.map((i) => i.path.join(".")),
      });
    }
  }

  // `leads` join pode vir como objeto único (FK 1:1 implícita) ou array
  // dependendo do Supabase client. Defendemos contra ambos os casos.
  const rawLeads = (data as { leads?: unknown }).leads;
  const leadRow: { rating: unknown; reviews_count: unknown; raw?: unknown } | null =
    Array.isArray(rawLeads)
      ? ((rawLeads[0] as
          | { rating: unknown; reviews_count: unknown; raw?: unknown }
          | undefined) ?? null)
      : ((rawLeads as
          | { rating: unknown; reviews_count: unknown; raw?: unknown }
          | null) ?? null);
  const leadRating = typeof leadRow?.rating === "number" ? leadRow.rating : null;
  const leadReviewsCount =
    typeof leadRow?.reviews_count === "number" ? leadRow.reviews_count : null;

  return {
    id: (data as { id: string }).id,
    slug: (data as { slug: string }).slug,
    status: (data as { status: SiteRow["status"] }).status,
    variables: (data as { variables: unknown }).variables,
    signed_at: (data as { signed_at: string | null }).signed_at,
    updated_at: (data as { updated_at: string }).updated_at,
    visual_identity: visualIdentity,
    lead_rating: leadRating,
    lead_reviews_count: leadReviewsCount,
    lead_raw: leadRow?.raw ?? null,
  };
}
