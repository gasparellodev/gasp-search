# `lib/dashboard/` — Spec Técnica

## Propósito

Queries server-side para o resumo do `/dashboard`. Agrega métricas de leads e
buscas recentes usando o Supabase do request, com RLS como isolamento.

## Arquivos

| Path | Propósito |
|---|---|
| `types.ts` | Tipos compartilháveis com Client Components (`DashboardCounters`, `DashboardSummary`, `RecentSearch`, `SourceBreakdownItem`, `FunnelStageStat`, `FUNNEL_STAGES`) |
| `summary.ts` | **Server-only.** `getDashboardSummary({ supabase, now? })` — retorna `DashboardCounters` (totais + estágios + últimas buscas). |
| `insights.ts` | **Server-only.** `getSourceBreakdown({ supabase })` e `getFunnelStats({ supabase })` — agregam leads por `source` e por `stage` para os widgets de insights (#124). |

## Regras de negócio

1. **RLS é a fonte da verdade.** Não filtrar `user_id` manualmente.
2. **`summary.ts` e `insights.ts` importam `server-only`** e não podem ser
   consumidos por Client Components; use `types.ts` para tipos no cliente.
3. **Novos 7d** usa `created_at >= now - 7 dias`, com `now` injetável em testes.
4. **Últimas buscas** sempre limita a 5 registros por `created_at desc`.
5. **`getSourceBreakdown`** retorna uma linha por `LeadSource` presente, com
   `total`, `closedWon` e `conversionRate = closedWon/total` (0 quando total
   é 0). Ordena por `total desc, source asc` para resposta determinística.
   Linhas com `source` fora do enum são ignoradas.
6. **`getFunnelStats`** retorna sempre 5 estágios na ordem
   `new → contacted → in_conversation → qualified → closed_won` (definida em
   `FUNNEL_STAGES`). `closed_lost` fica fora do funil. `dropRate` é `null` na
   primeira etapa e quando a etapa anterior tem zero leads; caso contrário,
   `(prev - curr) / prev` (pode ser negativo quando o estágio cresce vs
   anterior).
7. **Composição:** `app/api/dashboard/route.ts` chama os três funções em
   paralelo (`Promise.all`) e funde o resultado num `DashboardSummary`. Os
   módulos servidor não se chamam entre si — fácil de testar isoladamente.
8. Erros do Supabase lançam `Error` com prefixo `Falha ao carregar dashboard`.

## Dependências

- `@/types/database`
- `@/lib/validators/leads` (`LEAD_STAGES`, `LEAD_SOURCES`, tipos de estágio/origem)
- `@supabase/supabase-js` (tipo `SupabaseClient`)
