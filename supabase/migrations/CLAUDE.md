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
