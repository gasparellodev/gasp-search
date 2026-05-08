# `lib/messages/` — Spec Técnica

## Propósito

Helpers server-side da inbox `/messages` (Phase 5). Distintos de `lib/ai/messages.ts` (que faz listagem por lead — drawer "Mensagens IA"); aqui agrega por lead pra inbox global.

## Como adicionar

- Server-only (`import "server-only"`).
- RLS é a defesa primária — apenas use `createServerSupabase()`. Nada de `createServiceSupabase()` aqui.

## Arquivos

| Path | Propósito |
|---|---|
| `list-conversations.ts` | `listConversations(supabase)` — agrega `lead_messages` por `lead_id` pegando a última, enriquece com `leads.name`/`phone` |

## Dependências

- `@supabase/supabase-js`
- `@/types/database`
