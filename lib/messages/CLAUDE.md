# `lib/messages/` — Spec Técnica

## Propósito

Helpers server-side da inbox `/messages` (Phase 5). Distintos de `lib/ai/messages.ts` (que faz listagem por lead — drawer "Mensagens IA"); aqui agrega por lead pra inbox global.

## Como adicionar

- Server-only (`import "server-only"`).
- RLS é a defesa primária — apenas use `createServerSupabase()`. Nada de `createServiceSupabase()` aqui.

## Regras de negócio

1. **Inbox = chat real.** `listConversations()` aplica filtro `direction.eq.inbound,whatsapp_msg_id.not.is.null` — drafts de IA salvos pelo `/api/ai/generate-message` ficam de fora. Critério: outbound real é o que ganhou `whatsapp_msg_id` em `lib/evolution/send.ts` após `sendText`.
2. **Sem silenciar histórico de leads removidos (#133).** A migration 0023 reforça `ON DELETE CASCADE` em `lead_messages.lead_id`, então mensagens de um lead deletado já não existem no DB — o helper não precisa mais filtrar orphans defensivamente. Para o cenário raro de race entre os dois SELECTs (lead deletado ENTRE `lead_messages` e `leads`), `listConversations` retorna a thread com placeholder `"Lead removido"` em vez de aplicar `.filter(x => x !== null)`, evitando o silenciamento que motivou o bug original.

## Arquivos

| Path | Propósito |
|---|---|
| `list-conversations.ts` | `listConversations(supabase)` — agrega `lead_messages` por `lead_id` pegando a última (já filtrada como real), enriquece com `leads.name`/`phone`. Pós-#133: confia no cascade DB para garantir integridade; fallback `"Lead removido"` só em race extrema entre selects. |

## Dependências

- `@supabase/supabase-js`
- `@/types/database`
