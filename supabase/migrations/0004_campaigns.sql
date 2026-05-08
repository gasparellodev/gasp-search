-- ============================================================
-- Phase 5 — Campanhas (disparo em massa)
-- ============================================================
-- Modelo:
-- * campaigns guarda o "header" da campanha (template ou IA)
-- * campaign_targets é a tabela de execução por lead
--
-- Limite de leads por campanha (50 no MVP) é validado pela API,
-- não no schema, para permitir aumentar sem migration.

create type public.campaign_mode as enum (
  'template',
  'ai_per_lead'
);

create type public.campaign_status as enum (
  'draft',
  'running',
  'completed',
  'failed',
  'cancelled'
);

create type public.campaign_target_status as enum (
  'pending',
  'sent',
  'failed',
  'skipped'
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  mode public.campaign_mode not null,
  template_text text,
  -- Reusam os mesmos valores de AiMessageChannel/Tone do lib/ai.
  ai_channel text,
  ai_tone text,
  ai_goal text,
  status public.campaign_status not null default 'draft',
  total_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_mode_payload check (
    (mode = 'template' and template_text is not null and length(template_text) > 0)
    or (mode = 'ai_per_lead' and ai_channel is not null and length(ai_channel) > 0)
  )
);

create index campaigns_user_created_idx
  on public.campaigns (user_id, created_at desc);

create trigger campaigns_set_updated_at
before update on public.campaigns
for each row
execute function public.tg_set_updated_at();

create table public.campaign_targets (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  status public.campaign_target_status not null default 'pending',
  error_message text,
  -- sent_message_id ganha FK na migration 0005 (lead_messages_ext) — aqui
  -- fica como uuid puro pra evitar dependência circular entre 0004 e 0005.
  sent_message_id uuid,
  created_at timestamptz not null default now(),
  primary key (campaign_id, lead_id)
);

create index campaign_targets_status_idx
  on public.campaign_targets (campaign_id, status);

alter table public.campaigns enable row level security;
alter table public.campaign_targets enable row level security;

create policy "own campaigns"
  on public.campaigns
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- targets seguem a posse da campanha-mãe.
create policy "own campaign_targets"
  on public.campaign_targets
  for all
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  );
