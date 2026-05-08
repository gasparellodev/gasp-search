-- ============================================================
-- Phase 5 — WhatsApp instâncias por usuário
-- ============================================================
-- 1:1 com auth.users — cada usuário pareia o próprio WhatsApp via
-- QR Code dentro do gasp-search. O cliente Evolution lida com a
-- mecânica; aqui guardamos apenas estado para a UI e RLS.

create type public.whatsapp_status as enum (
  'disconnected',
  'qr_pending',
  'connecting',
  'connected',
  'error'
);

create table public.whatsapp_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  evo_instance text not null,
  status public.whatsapp_status not null default 'disconnected',
  phone_number text,
  qr_code text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reusa o trigger de updated_at definido em 0001_init.sql.
create trigger whatsapp_instances_set_updated_at
before update on public.whatsapp_instances
for each row
execute function public.tg_set_updated_at();

alter table public.whatsapp_instances enable row level security;

create policy "own whatsapp_instance"
  on public.whatsapp_instances
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
