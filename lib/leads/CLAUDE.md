# `lib/leads/` — Spec Técnica

## Propósito

Helpers server-side para leads — queries com RLS, mappers e
utilities de domínio que vivem fora do request handler.

## Como adicionar

- **Query/utility nova**: arquivo em `lib/leads/<nome>.ts` com
  `import "server-only"` na primeira linha.
- **Cobrir** com testes em `tests/unit/lib/leads/<nome>.test.ts` antes
  da implementação (TDD).
- **Tipos exportados** que descrevem o shape devolvido para a UI
  (`LeadListItem`, `LeadTagSummary`, etc.) ficam aqui — não em `types/`.

## Regras de negócio

1. **RLS é a fonte da verdade** — toda query usa `createServerSupabase()`
   do request, nunca o `service_role`. Não precisa filtrar `user_id`
   manualmente; o Postgres RLS faz isso.
2. **Pagination via `range(from, to)` + `count: "exact"`**. Sempre use o
   helper `parseLeadsListParams` para garantir page/pageSize válidos
   antes de chamar `listLeads`.
3. **Tags vêm via embed** `lead_tags(tag:tags(...))` e são achatadas
   para `LeadListItem.tags` (array plano). UI nunca vê o `lead_tags`
   intermediário.
4. **Erros do Supabase lançam `Error`** com mensagem em PT-BR
   (`Falha ao listar leads: …`); o caller decide o que mostrar.

## Arquivos

| Path | Propósito |
|---|---|
| `list-leads.ts` | `listLeads({ supabase, params })` — query paginada com tags |

## Dependências

- `@supabase/supabase-js` (apenas o tipo `SupabaseClient`)
- `@/types/database` (helpers `Tables<>`)
- `@/lib/validators/leads` (tipo `LeadsListParams`)
