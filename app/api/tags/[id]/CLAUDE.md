# `app/api/tags/[id]/` — Spec Técnica

## Propósito

Mutations autenticadas para atualizar ou remover uma tag do usuário.

## Regras de negócio

1. Auth obrigatória via `createServerSupabase().auth.getUser()`.
2. PATCH valida body com `updateTagSchema`.
3. Duplicidade de nome retorna 409; tag ausente ou bloqueada por RLS retorna
   404.
4. Falhas inesperadas usam `apiErrorResponse()` para log estruturado e resposta
   amigável.

## Arquivos

| Path | Propósito |
|---|---|
| `route.ts` | `PATCH` e `DELETE /api/tags/[id]` |

## Dependências

- `@/lib/supabase/server`
- `@/lib/api/errors`
- `@/lib/leads/tags-crud`
- `@/lib/validators/tags`
