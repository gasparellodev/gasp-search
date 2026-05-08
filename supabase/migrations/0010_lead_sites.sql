-- ============================================================
-- 0010_lead_sites.sql
-- Phase 7 — Site Generator (Concessionárias) — M1.1
-- ------------------------------------------------------------
-- Persiste um site por lead. Variáveis paramétricas em JSONB
-- (validadas em runtime via Zod, ver `types/lead-site.ts` na M1.2).
-- Slug é GLOBAL único (URL pública /sites/[slug]).
-- ============================================================

-- ------------------------------------------------------------
-- Função genérica `set_updated_at` (spec §4 chama por este nome).
-- Já existe `public.tg_set_updated_at` em 0001_init.sql, mas o spec
-- mestre pede esta variante sem prefixo. Criamos `or replace` pra
-- ser idempotente caso futuras migrations queiram reutilizar.
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ============================================================
-- Tabela lead_sites
-- ============================================================
create table public.lead_sites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  lead_id     uuid not null references public.leads(id) on delete cascade,
  slug        text not null,
  status      text not null default 'draft'
              check (status in ('draft', 'published', 'sent', 'archived')),
  variables   jsonb not null default '{}'::jsonb,
  generation_error text,
  generated_at   timestamptz,
  published_at   timestamptz,
  sent_at        timestamptz,
  view_count     integer not null default 0,
  last_viewed_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Índices
--   - user_lead_uniq: cada lead tem no máximo 1 site por usuário
--   - slug_uniq:      slug é global (URL pública)
--   - user_status_idx: listagens "meus sites por status"
-- ------------------------------------------------------------
create unique index lead_sites_user_lead_uniq on public.lead_sites(user_id, lead_id);
create unique index lead_sites_slug_uniq      on public.lead_sites(slug);
create index        lead_sites_user_status_idx on public.lead_sites(user_id, status);

-- ============================================================
-- RLS — multi-tenant por usuário
-- service_role bypassa RLS por padrão (Supabase). A rota pública
-- /sites/[slug] (M2.1) usa o cliente `service` em lib/supabase/service.ts
-- com query single-purpose (read-only por slug).
-- ============================================================
alter table public.lead_sites enable row level security;

create policy lead_sites_select on public.lead_sites
  for select using (auth.uid() = user_id);

create policy lead_sites_insert on public.lead_sites
  for insert with check (auth.uid() = user_id);

create policy lead_sites_update on public.lead_sites
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy lead_sites_delete on public.lead_sites
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Trigger updated_at
-- ------------------------------------------------------------
create trigger lead_sites_set_updated_at
before update on public.lead_sites
for each row execute function public.set_updated_at();
