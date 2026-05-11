-- ============================================================
-- 0017_lead_sites_v1_backup_rls.sql
-- Phase 7 — Sprint 0 follow-up — issue #236
-- Requires: 0016_site_variables_v2.sql (creates the target table)
-- ------------------------------------------------------------
-- Hardens `public.lead_sites_v1_backup` (criada em 0016 via
-- `CREATE TABLE ... AS TABLE public.lead_sites WITH NO DATA`)
-- com RLS + REVOKE/GRANT explícitos.
--
-- Diagnóstico:
--   * `CREATE TABLE ... AS` NÃO herda RLS nem policies da
--     tabela origem. A backup nasceu sem RLS, com grants default
--     pro role `anon` e `authenticated` via PostgREST.
--   * Tabelas em schema `public` são auto-expostas pelo PostgREST
--     do Supabase — sem RLS + sem REVOKE = leak cross-tenant
--     silencioso (qualquer anon poderia listar todos os backups).
--
-- Decisões arquiteturais (validadas pelo PO em #236):
--   1. **Sem CREATE POLICY** intencional. RLS habilitada sem
--      policies = deny-all por padrão para anon/authenticated.
--      Backup só serve para rollback admin manual via service_role
--      (SQL Editor do Supabase Dashboard usa service_role).
--   2. **Defense-in-depth** — três camadas:
--      a) REVOKE ALL FROM PUBLIC/anon/authenticated
--      b) ENABLE ROW LEVEL SECURITY (deny-all sem policies)
--      c) GRANT SELECT apenas para service_role (server-only)
--   3. **Idempotente** — `ENABLE RLS` é no-op se já ativo;
--      `REVOKE` em grant inexistente é no-op; `GRANT` é
--      idempotente. Migration pode rodar N vezes.
--
-- Rollback (manual, se necessário):
-- ```sql
-- BEGIN;
-- ALTER TABLE public.lead_sites_v1_backup DISABLE ROW LEVEL SECURITY;
-- GRANT ALL ON public.lead_sites_v1_backup TO authenticated;
-- GRANT ALL ON public.lead_sites_v1_backup TO anon;
-- COMMIT;
-- ```
-- ============================================================

-- ------------------------------------------------------------
-- 1) REVOKE grants default (defesa extra contra PostgREST exposure)
-- ------------------------------------------------------------
-- Ordem: PUBLIC primeiro (cobre grants implícitos), depois roles
-- nominais. Em Postgres, REVOKE em grant inexistente é no-op
-- silencioso, então idempotência é gratuita.

revoke all on public.lead_sites_v1_backup from public;
revoke all on public.lead_sites_v1_backup from anon;
revoke all on public.lead_sites_v1_backup from authenticated;

-- ------------------------------------------------------------
-- 2) ENABLE ROW LEVEL SECURITY (deny-all sem policies)
-- ------------------------------------------------------------
-- Sem CREATE POLICY: RLS ON + 0 policies = deny-all efetivo para
-- todos os roles exceto bypass (service_role / superuser).
-- Decisão deliberada — backup só serve rollback admin manual.

alter table public.lead_sites_v1_backup enable row level security;

-- ------------------------------------------------------------
-- 3) GRANT SELECT para service_role (server-only rollback path)
-- ------------------------------------------------------------
-- service_role bypassa RLS por design, mas precisa do GRANT no
-- nível de tabela. Apenas SELECT — backup é read-only do ponto
-- de vista da app; eventual restore usa UPDATE no `lead_sites`
-- (não na backup), conforme rollback documentado em 0016.

grant select on public.lead_sites_v1_backup to service_role;

-- ------------------------------------------------------------
-- 4) Documentação no metadata do Postgres
-- ------------------------------------------------------------

comment on table public.lead_sites_v1_backup is
  'Backup table from migration 0016 (v1->v2 site variables). RLS enabled with no policies = deny-all for anon/authenticated. Only service_role can SELECT for manual rollback. See 0017_lead_sites_v1_backup_rls.sql.';
