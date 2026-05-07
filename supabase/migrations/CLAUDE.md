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
