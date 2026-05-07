-- ============================================================
-- Gasp Search — Schema inicial
-- ============================================================
-- Spec: docs/CLAUDE.md (raiz) §5 do spec original.
-- Aplicação: ver supabase/CLAUDE.md.

create extension if not exists "pgcrypto";

-- ============================================================
-- profiles (espelha auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- tags (por usuário)
-- ============================================================
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ============================================================
-- search_jobs (rastrear corridas Apify)
-- ============================================================
create type public.search_source as enum (
  'google_maps',
  'instagram',
  'website_contact'
);

create type public.search_status as enum (
  'queued',
  'running',
  'succeeded',
  'failed'
);

create table public.search_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source public.search_source not null,
  input jsonb not null,
  apify_run_id text,
  status public.search_status not null default 'queued',
  results_count int not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index search_jobs_user_created_idx
  on public.search_jobs (user_id, created_at desc);

-- ============================================================
-- leads
-- ============================================================
create type public.lead_stage as enum (
  'new',
  'contacted',
  'in_conversation',
  'qualified',
  'closed_won',
  'closed_lost'
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source public.search_source not null,
  source_search_job_id uuid references public.search_jobs(id) on delete set null,

  -- Identidade
  name text not null,
  category text,
  city text,
  state text,
  country text,

  -- Contato
  phone text,
  email text,
  website text,
  instagram_handle text,
  whatsapp text,

  -- Sinais
  has_website boolean,
  rating numeric(2,1),
  reviews_count int,
  followers_count int,

  -- CRM
  stage public.lead_stage not null default 'new',
  score int not null default 0 check (score between 0 and 100),
  notes text,

  -- Raw payload
  raw jsonb,
  enriched_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dedup: unique parcial só faz sentido quando o campo existe.
create unique index leads_user_source_website_uniq
  on public.leads (user_id, source, website)
  where website is not null;

create unique index leads_user_source_instagram_uniq
  on public.leads (user_id, source, instagram_handle)
  where instagram_handle is not null;

create index leads_user_stage_idx on public.leads (user_id, stage);
create index leads_user_created_idx on public.leads (user_id, created_at desc);
create index leads_raw_gin on public.leads using gin (raw);

-- ============================================================
-- lead_tags (M:N)
-- ============================================================
create table public.lead_tags (
  lead_id uuid not null references public.leads(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (lead_id, tag_id)
);

create index lead_tags_tag_idx on public.lead_tags (tag_id);

-- ============================================================
-- lead_messages (geradas pela IA)
-- ============================================================
create table public.lead_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  tone text,
  content text not null,
  created_at timestamptz not null default now()
);

create index lead_messages_lead_created_idx
  on public.lead_messages (lead_id, created_at desc);

-- ============================================================
-- Trigger: updated_at em leads
-- ============================================================
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger leads_set_updated_at
before update on public.leads
for each row
execute function public.tg_set_updated_at();

-- ============================================================
-- RLS — habilitar e políticas por dono
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.tags          enable row level security;
alter table public.search_jobs   enable row level security;
alter table public.leads         enable row level security;
alter table public.lead_tags     enable row level security;
alter table public.lead_messages enable row level security;

create policy "own profile"
  on public.profiles
  for all
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "own tags"
  on public.tags
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own search_jobs"
  on public.search_jobs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own leads"
  on public.leads
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own lead_messages"
  on public.lead_messages
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- lead_tags: dono via lead.
create policy "own lead_tags"
  on public.lead_tags
  for all
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_id and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.leads l
      where l.id = lead_id and l.user_id = auth.uid()
    )
  );

-- ============================================================
-- Trigger: criar profile ao cadastrar usuário
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();
