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
| `list-leads.ts` | `listLeads({ supabase, params, filters? })` — query paginada com filtros e tags |
| `list-tags.ts` | `listTags({ supabase })` — tags do user para combobox de filtros |
| `tags-crud.ts` | `createTag`, `updateTag`, `deleteTag` + `DuplicateTagError` |
| `crud.ts` | `getLead`, `createLead`, `updateLead`, `deleteLead` — CRUD com flatten de tags |
| `list-by-stage.ts` | `listLeadsByStage({ supabase })` — leads agrupados em board do `/pipeline` |
| `stage-presentation.ts` | **Client-safe (sem `import "server-only"`).** Fonte canônica de `STAGE_LABEL` (PT-BR), `STAGE_VARIANT` (Badge variant) e `STAGE_ACCENT` (Tailwind `border-l-*`) por `LeadStage`. Consumido por `components/pipeline/board.tsx`, `components/leads/leads-table.tsx`, `components/leads/lead-detail-drawer.tsx`, `components/leads/filters-bar.tsx`, `components/dashboard/dashboard-view.tsx` e `app/(app)/leads/[id]/page.tsx`. Esta é a única exceção à regra "lib/leads é server-only" — é apresentação pura e precisa rodar no Client. Ao adicionar um estágio novo em `LEAD_STAGES`, atualize os 3 maps aqui (o `Record<LeadStage, …>` força via tipo). |

## Dependências

- `@supabase/supabase-js` (apenas o tipo `SupabaseClient`)
- `@/types/database` (helpers `Tables<>`)
- `@/lib/validators/leads` (tipo `LeadsListParams`)
