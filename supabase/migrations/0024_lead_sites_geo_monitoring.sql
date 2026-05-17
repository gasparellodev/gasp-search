-- ============================================================
-- Phase 7 / Frente 04 GEO/AI — issue #G5
-- Brand mention monitoring results from external AI search platforms.
-- ============================================================
-- Tabela operacional: persiste resultados do script de monitoramento
-- de menções de marca em plataformas de AI search (Perplexity, ChatGPT).
-- RLS restrita a service_role — sem leitura de client.

create table if not exists public.lead_sites_geo_monitoring (
  id uuid primary key default gen_random_uuid(),
  lead_site_id uuid not null references public.lead_sites(id) on delete cascade,
  query text not null,
  source text not null check (source in ('perplexity', 'chatgpt', 'mock')),
  cited boolean not null,
  snippet text,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists lead_sites_geo_monitoring_site_idx
  on public.lead_sites_geo_monitoring (lead_site_id, checked_at desc);

alter table public.lead_sites_geo_monitoring enable row level security;

-- Service role only — tabela operacional, sem read pra client.
create policy "lead_sites_geo_monitoring_service_role_only"
  on public.lead_sites_geo_monitoring
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table public.lead_sites_geo_monitoring is
  'Phase 7 / Frente 04 / #G5. Resultados do script de brand mention monitoring (Perplexity, ChatGPT). Operacional — sem read pra client.';
