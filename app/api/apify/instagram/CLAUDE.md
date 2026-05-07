# `app/api/apify/instagram/` — Spec Técnica

## Propósito

Route handler protegido para criar busca Instagram, executar o actor Apify em
background e persistir perfis como leads.

## Regras de negócio

1. Auth obrigatória via `createServerSupabase().auth.getUser()`.
2. Body validado por `searchInstagramSchema` antes de qualquer side effect.
3. Handler responde `{ jobId, status: "queued" }`; execução longa roda via
   `after()` com `executeSearchJob`.
4. Upsert usa conflito `user_id,source,instagram_handle`.
5. Falhas inesperadas usam `apiErrorResponse()` para log estruturado e resposta
   amigável sem stack.

## Arquivos

| Path | Propósito |
|---|---|
| `route.ts` | `POST /api/apify/instagram` |

## Dependências

- `@/lib/supabase/server`
- `@/lib/api/errors`
- `@/lib/validators/search`
- `@/lib/apify/run-and-persist`
- `@/lib/apify/instagram`
- `@/lib/env`
