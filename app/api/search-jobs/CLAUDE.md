# `app/api/search-jobs/` — Spec Técnica

## Propósito

Endpoints protegidos para polling de buscas Apify iniciadas de forma
assíncrona.

## Regras de negócio

1. Auth obrigatória; RLS garante que só o dono vê o job.
2. `GET /api/search-jobs/[id]` retorna status, contagem e mensagem de erro
   para o `SearchForm` decidir redirecionamento/toast.
3. Falhas inesperadas usam `apiErrorResponse()`; job inexistente ou bloqueado
   por RLS retorna 404.

## Arquivos

| Path | Propósito |
|---|---|
| `[id]/route.ts` | Polling de status por job id |

## Dependências

- `@/lib/supabase/server`
- `@/lib/api/errors`
