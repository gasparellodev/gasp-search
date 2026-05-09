-- ============================================================
-- 0012_lead_sites_archived_at.sql
-- Phase 7 — Site Generator (Concessionárias) — M3.3 (#169)
-- ------------------------------------------------------------
-- Adiciona `archived_at timestamptz` em `lead_sites` para registrar
-- quando o site foi arquivado pela ação `archiveLeadSite()`.
--
-- Por que coluna dedicada:
--   - Manter a trilha temporal isolada de `updated_at` (que muda em
--     qualquer write).
--   - `restoreLeadSite()` limpa `archived_at` voltando pra NULL.
--   - Suporta auditoria/rollup de "sites arquivados em X período".
-- ============================================================

alter table public.lead_sites
  add column if not exists archived_at timestamptz;
