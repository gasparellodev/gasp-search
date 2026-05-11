-- ============================================================
-- 0020_lead_form_submissions.sql
--
-- Phase 7 / Sprint 4 / #H3 — issue #223
--
-- Persiste submissions do `<HomeContactFormQuick>` (e demais formulários
-- públicos de captura nos sites das concessionárias) com audit LGPD por
-- submission (consent_text + consent_ip + consent_user_agent +
-- consent_timestamp). Tabela é writable apenas via `service_role` (rota
-- pública sem `auth.uid()`); leitura é restrita ao dono do `lead_sites`
-- via RLS.
--
-- Decisão PO: audit LGPD por submission (não global em outra tabela)
-- — defensável juridicamente (cada lead capturado tem registro
-- imutável do consentimento explícito no momento da coleta).
-- ============================================================

create table public.lead_form_submissions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  lead_site_id         uuid not null references public.lead_sites(id) on delete cascade,
  name                 text not null,
  phone                text not null,
  email                text not null,
  message              text,
  model                text,
  consent_text         text not null,
  consent_ip           inet,
  consent_user_agent   text,
  consent_timestamp    timestamptz not null default now(),
  created_at           timestamptz not null default now()
);

-- Índice composto pra rate-limit por IP (query: count where ip = X and
-- created_at > now() - interval '1 hour').
create index idx_lead_form_submissions_ip_created
  on public.lead_form_submissions (consent_ip, created_at desc);

-- Índice pra listagem futura "minhas submissions" no app interno.
create index idx_lead_form_submissions_user
  on public.lead_form_submissions (user_id);

-- ============================================================
-- RLS — multi-tenant por usuário
-- service_role bypassa RLS por padrão (Supabase). A Server Action
-- `submitSiteForm` (rota pública, sem `auth.uid()`) usa service-role
-- pra INSERT. Leitura é restrita ao dono via policy.
-- ============================================================
alter table public.lead_form_submissions enable row level security;

create policy lead_form_submissions_owner_select on public.lead_form_submissions
  for select using (auth.uid() = user_id);
