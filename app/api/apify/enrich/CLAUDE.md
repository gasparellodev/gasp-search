# `app/api/apify/enrich/` — Spec Técnica

## Propósito

Route handler protegido para enriquecer leads selecionados usando actor de
contato web do Apify.

## Regras de negócio

1. Auth obrigatória via `createServerSupabase().auth.getUser()`.
2. Body validado por `enrichRequestSchema`.
3. RLS filtra os leads acessíveis; leads sem website entram em `failedIds`.
4. Falhas inesperadas usam `apiErrorResponse()` para log estruturado com
   `requestId`, `route` e `userId`.

## Arquivos

| Path | Propósito |
|---|---|
| `route.ts` | `POST /api/apify/enrich` |

## Dependências

- `@/lib/supabase/server`
- `@/lib/api/errors`
- `@/lib/apify/enrich`
- `@/lib/validators/search`
