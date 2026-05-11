-- ============================================================
-- 0018_lead_sites_signed_at.sql
-- Phase 7 — Sprint 0 / #F2 SEO foundation — issue #199
-- Requires: 0010_lead_sites.sql (cria a tabela `lead_sites`)
-- ------------------------------------------------------------
-- Adiciona coluna `signed_at timestamptz NULL` em `lead_sites`
-- registrando o momento em que o **cliente assinou o contrato**.
--
-- Contrato semântico (validado pelo PO em #199):
--   * `signed_at` é DISTINTO de `published_at` e `sent_at`.
--     - `published_at` = quando o site foi gerado/publicado tecnicamente
--       (`generateLeadSite` em `app/actions/lead-site.ts`).
--     - `sent_at` = quando o preview foi enviado via WhatsApp.
--     - `signed_at` = momento de fechamento comercial (assinatura).
--   * Habilita o gate `isIndexable(site)` em `lib/sites/metadata.ts`:
--     `status IN ('published','sent') AND signed_at IS NOT NULL`. Só
--     sites efetivamente contratados entram em SERP — protege a UX
--     do cliente final (sem leak de previews em buscas Google).
--   * V1: admin marca `signed_at` manualmente (SQL Editor / future
--     admin UI). Sem backfill — coluna nasce NULL em todas as rows.
--
-- Idempotência:
--   * `ADD COLUMN IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` —
--     migration pode rodar N vezes sem falha.
--
-- Index parcial:
--   * `WHERE signed_at IS NOT NULL` — só indexa rows assinadas.
--     Otimiza queries futuras de `app/sitemap.ts` (#212) que filtram
--     por `isIndexable` — não precisamos varrer milhares de leads não
--     assinados. Volume V1 é baixo, mas o pattern é gratuito.
--
-- Rollback (manual, se necessário):
-- ```sql
-- BEGIN;
-- DROP INDEX IF EXISTS lead_sites_signed_at_idx;
-- ALTER TABLE public.lead_sites DROP COLUMN IF EXISTS signed_at;
-- COMMIT;
-- ```
-- ============================================================

-- ------------------------------------------------------------
-- 1) Adiciona coluna `signed_at` (nullable, sem default)
-- ------------------------------------------------------------

alter table public.lead_sites
  add column if not exists signed_at timestamptz;

-- ------------------------------------------------------------
-- 2) Index parcial para queries `WHERE signed_at IS NOT NULL`
-- ------------------------------------------------------------
-- Cobre `isIndexable()`-style lookups do sitemap (#212) sem custo de
-- indexar a maioria das rows (que ficarão NULL no V1).

create index if not exists lead_sites_signed_at_idx
  on public.lead_sites (signed_at)
  where signed_at is not null;

-- ------------------------------------------------------------
-- 3) Documentação no metadata do Postgres
-- ------------------------------------------------------------

comment on column public.lead_sites.signed_at is
  'Momento de assinatura do contrato pelo cliente. Distinto de published_at (publicação técnica) e sent_at (envio do preview). Habilita isIndexable() em lib/sites/metadata.ts (status IN (published, sent) AND signed_at IS NOT NULL). NULL até confirmação manual via admin. Issue #199.';
