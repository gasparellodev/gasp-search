-- ============================================================
-- 0021_consent_logs.sql
--
-- Phase 7 / #234 — LGPD Cookie Consent
--
-- Registra decisões granulares do banner de cookies dos sites públicos.
-- Escrita acontece via service_role em Server Action; visitantes anônimos
-- ficam com user_id null. RLS fica habilitado para defense-in-depth e só
-- permite leitura futura de linhas vinculadas ao próprio auth.uid().
-- ============================================================

create table public.consent_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  ip            inet,
  user_agent    text,
  timestamp     timestamptz not null,
  consent_text  text not null,
  version       text not null,
  action        text not null check (action in ('accept_all', 'accept_selected', 'reject')),
  categories    jsonb not null check (
    categories ? 'necessary'
    and categories ? 'analytics'
    and categories ? 'marketing'
  ),
  created_at    timestamptz not null default now()
);

create index idx_consent_logs_user
  on public.consent_logs (user_id)
  where user_id is not null;

create index idx_consent_logs_timestamp
  on public.consent_logs (timestamp desc);

alter table public.consent_logs enable row level security;

create policy consent_logs_owner_select on public.consent_logs
  for select using (auth.uid() = user_id);
