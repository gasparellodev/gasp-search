# `supabase/migrations/` — Spec Técnica

## Propósito

Migrations SQL aplicadas em ordem numérica.

## Convenções

- Nome: `NNNN_<descricao>.sql` (ex.: `0001_init.sql`, `0002_add_lead_archived.sql`).
- Cada arquivo é **forward-only**. Nunca edite uma migration já aplicada em produção. Para reverter, crie nova migration que desfaz.
- Comentários no SQL devem explicar o **porquê**, não o quê (`SELECT` se explica sozinho).

## Arquivos

| Path | Propósito |
|---|---|
| `0001_init.sql` | Schema inicial: profiles, tags, search_jobs, leads, lead_tags, lead_messages + RLS + triggers |
| `0002_fix_lead_upsert_constraints.sql` | Substitui dedup de leads por índices únicos parciais (website / instagram_handle) |
| `0003_whatsapp_instances.sql` | Phase 5 — tabela `whatsapp_instances` (1:1 user) + enum `whatsapp_status` + RLS por user_id |
| `0004_campaigns.sql` | Phase 5 — tabelas `campaigns` + `campaign_targets` + 3 enums (campaign_mode, campaign_status, campaign_target_status) + RLS |
| `0005_lead_messages_ext.sql` | Phase 5 — estende `lead_messages` (direction, status, whatsapp_msg_id, campaign_id, error_message, ai_generated) + FK `campaign_targets.sent_message_id → lead_messages.id` |
| `0010_lead_sites.sql` | Phase 7 M1.1 — tabela `lead_sites` + índices + RLS + trigger `set_updated_at` |
| `0011_generation_throttle.sql` | Phase 7 M1.7 — tabela `generation_throttle` (rate-limit DB-backed) |
| `0012_lead_sites_archived_at.sql` | Phase 7 M3.3 (#169) — coluna `archived_at timestamptz` em `lead_sites` |
| `0013_campaigns_type.sql` | Phase 7 M4.3 (#172) — coluna `type` em campaigns (`'message' \| 'site_preview'`) + index parcial |
| `0014_lead_sites_generation_error_backfill.sql` | Phase 7 hotfix — backfill de `generation_error` em rows legadas |
| `0015_lead_sites_rls_repair.sql` | Phase 7 hotfix 2026-05-09 — re-aplica RLS policies de `lead_sites` (idempotent) |
| `0016_site_variables_v2.sql` | Phase 7 #197 PR-C — migra `lead_sites.variables` shape v1 flat → v2 nested. Cria tabela backup `lead_sites_v1_backup` (rollback sem dump externo), declara função PL/pgSQL `__migrate_site_variables_v1_to_v2(jsonb) RETURNS jsonb` IMMUTABLE como single source of truth (espelha `lib/sites/migrate-variables.ts:migrateV1ToV2`), e roda UPDATE idempotent filtrado por `not (variables ? 'schema_version')`. Renomeia `contact_hero_image_url` → `contact_image_url` em `brand_assets`. Address parse best-effort; retorna `null` quando regex v1 não casa (Address é nullable em v2). Cars[] ganha `category: 'Sedan'`, `plates_visible: false`, `photos` derivado de `gallery_urls`. Rollback documentado em comentário SQL (UPDATE de backup + DROP function + DROP table). |
