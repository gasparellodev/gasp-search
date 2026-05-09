-- ============================================================
-- 0013_campaigns_type.sql
-- Phase 7 — Site Generator (Concessionárias) — M4.3 (#172)
-- ------------------------------------------------------------
-- Adiciona coluna `type` em campaigns para distinguir entre
-- a campanha clássica de mensagens (`'message'`, default — preserva
-- o comportamento da Phase 5/6) e a nova campanha que dispara prévias
-- de site geradas (`'site_preview'`, processada pelo hook
-- `lib/campaigns/processor.ts` introduzido em #172).
--
-- Implementação:
--   * `text` com check constraint (em vez de enum) — adicionar valores
--     futuros (e.g. `'cold_call'`) é uma migration trivial sem precisar
--     `alter type`.
--   * Default `'message'` preenche linhas legadas; `not null` é seguro
--     porque o default cobre o backfill.
--   * Index parcial em `(user_id, type)` filtrado por type='site_preview'
--     pra acelerar listagens "minhas campanhas de site preview" (UI da
--     próxima issue M4.4 #173).
-- ============================================================

alter table public.campaigns
  add column type text not null default 'message';

alter table public.campaigns
  add constraint campaigns_type_check
  check (type in ('message', 'site_preview'));

-- Index parcial — só indexa rows site_preview (volume esperado baixo).
create index campaigns_user_type_site_preview_idx
  on public.campaigns (user_id, created_at desc)
  where type = 'site_preview';
