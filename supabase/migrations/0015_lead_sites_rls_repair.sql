-- ============================================================
-- Phase 7 hotfix: re-aplica RLS policies de `lead_sites`
-- ============================================================
--
-- Sintoma observado em 2026-05-09:
--   - User autenticado com auth.uid() = user_id da row
--   - Service-role bypass (sem RLS) acha a row
--   - Mesma query com sessão anon+JWT correto retorna []
--   - Sem erro, sem mensagem — RLS silenciosamente filtra tudo
--
-- Diagnóstico: migration 0010_lead_sites.sql declara `enable row level
-- security` + 4 policies (`lead_sites_select|insert|update|delete`),
-- mas no DB algumas/todas estão ausentes ou divergem do esperado. Como
-- RLS está ON, a ausência de policy SELECT bloqueia tudo (deny-by-default).
--
-- Esta migration é idempotente: `drop policy if exists` + `create policy`.
-- Pode rodar quantas vezes quiser sem efeito colateral.

alter table public.lead_sites enable row level security;

drop policy if exists lead_sites_select on public.lead_sites;
create policy lead_sites_select on public.lead_sites
  for select using (auth.uid() = user_id);

drop policy if exists lead_sites_insert on public.lead_sites;
create policy lead_sites_insert on public.lead_sites
  for insert with check (auth.uid() = user_id);

drop policy if exists lead_sites_update on public.lead_sites;
create policy lead_sites_update on public.lead_sites
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists lead_sites_delete on public.lead_sites;
create policy lead_sites_delete on public.lead_sites
  for delete using (auth.uid() = user_id);
