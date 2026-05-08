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
