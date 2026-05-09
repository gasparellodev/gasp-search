-- ============================================================
-- 0011_generation_throttle.sql
-- Phase 7 — Site Generator (Concessionárias) — M1.7 (issue #159)
-- ------------------------------------------------------------
-- Persiste tentativas de `generateLeadSite(leadId)` por usuário pra
-- enforcement de rate-limit DB-backed (5 chamadas / 60s).
--
-- A query de rate-limit roda em service_role (bypass RLS) pra:
--   1. Contar tentativas na janela ANTES do trabalho pesado.
--   2. Inserir nova tentativa imediatamente após a aprovação do limite.
--
-- RLS isola visibilidade pra usuários comuns (audit/observability).
-- ============================================================

create table public.generation_throttle (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  attempted_at  timestamptz not null default now()
);

-- Índice composto: a query do rate-limit é
--   `select count(*) from generation_throttle
--    where user_id = $1 and attempted_at > now() - interval '60 seconds'`
-- O DESC otimiza buscas que precisariam ordenar pelas tentativas mais
-- recentes (futuro: `retry_after_seconds` calculado da row mais antiga
-- da janela).
create index generation_throttle_user_time
  on public.generation_throttle(user_id, attempted_at desc);

-- ============================================================
-- RLS — multi-tenant por usuário
-- service_role bypassa RLS por padrão (Supabase). O orquestrador
-- `generateLeadSite` (#159) usa service_role para contar/inserir,
-- garantindo enforcement servidor-side mesmo se o caller for `anon`.
-- ============================================================
alter table public.generation_throttle enable row level security;

create policy "throttle_select_own" on public.generation_throttle
  for select using (auth.uid() = user_id);

create policy "throttle_insert_own" on public.generation_throttle
  for insert with check (auth.uid() = user_id);
