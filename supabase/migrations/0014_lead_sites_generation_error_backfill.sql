-- ============================================================
-- Phase 7 hotfix: backfill de colunas declaradas em 0010 mas ausentes em DBs
-- ============================================================
--
-- Migration `0010_lead_sites.sql` declara `generation_error text`,
-- `generated_at`, `published_at`, `sent_at`, `view_count`, `last_viewed_at`,
-- mas em alguns ambientes a tabela foi criada antes dessas colunas serem
-- adicionadas (ou o DDL aplicado divergiu do arquivo no repo).
--
-- Sintomas observados em prod (2026-05-09):
--   - `column lead_sites.generation_error does not exist` em
--     `persistDraftWithError` quando o pipeline de `generateLeadSite` cai
--     em `validation`/`ai_error` — mascarando o erro real do Zod.
--   - `column lead_sites.published_at does not exist` em
--     `getLeadSiteCardData` ao tentar carregar o card no drawer.
--
-- Esta migration é idempotente: usa `add column if not exists`. Pode rodar
-- em qualquer DB sem efeito colateral, mesmo que as colunas já existam.

alter table public.lead_sites
  add column if not exists generation_error text;

alter table public.lead_sites
  add column if not exists generated_at timestamptz;

alter table public.lead_sites
  add column if not exists published_at timestamptz;

alter table public.lead_sites
  add column if not exists sent_at timestamptz;

alter table public.lead_sites
  add column if not exists view_count integer not null default 0;

alter table public.lead_sites
  add column if not exists last_viewed_at timestamptz;

comment on column public.lead_sites.generation_error is
  'Mensagem de erro estruturada quando status=draft (JSON serializada de SiteVariablesValidationError ou GenerationError).';
comment on column public.lead_sites.generated_at is
  'Timestamp da última geração bem-sucedida do conteúdo (status transitou pra published).';
comment on column public.lead_sites.published_at is
  'Timestamp da publicação. Setado quando status passa pra published pela primeira vez.';
comment on column public.lead_sites.sent_at is
  'Timestamp do envio via WhatsApp (`sendLeadSiteWhatsApp`, #171).';
comment on column public.lead_sites.view_count is
  'Contador de page views da rota pública /sites/[slug]. Incremento assíncrono.';
comment on column public.lead_sites.last_viewed_at is
  'Última visita registrada na rota pública /sites/[slug].';
