# `lib/dashboard/` — Spec Técnica

## Propósito

Queries server-side para o resumo do `/dashboard`. Agrega métricas de leads e
buscas recentes usando o Supabase do request, com RLS como isolamento.

## Arquivos

| Path | Propósito |
|---|---|
| `types.ts` | Tipos compartilháveis com Client Components (`DashboardSummary`, `RecentSearch`) |
| `summary.ts` | **Server-only.** `getDashboardSummary({ supabase, now? })` |

## Regras de negócio

1. **RLS é a fonte da verdade.** Não filtrar `user_id` manualmente.
2. **`summary.ts` importa `server-only`** e não pode ser importado por Client
   Components; use `types.ts` para tipos no cliente.
3. **Novos 7d** usa `created_at >= now - 7 dias`, com `now` injetável em testes.
4. **Últimas buscas** sempre limita a 5 registros por `created_at desc`.
5. Erros do Supabase lançam `Error` com prefixo `Falha ao carregar dashboard`.

## Dependências

- `@/types/database`
- `@/lib/validators/leads` (`LEAD_STAGES`, tipos de estágio/origem)
- `@supabase/supabase-js` (tipo `SupabaseClient`)
