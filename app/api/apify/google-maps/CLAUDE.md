# `app/api/apify/google-maps/` — Spec Técnica

## Propósito

Route handler protegido para criar uma busca Google Maps, executar o actor Apify
em background e persistir leads no Supabase.

## Regras de negócio

1. Auth é obrigatória via `createServerSupabase().auth.getUser()`.
2. Body é validado por `searchGoogleMapsSchema` antes de chamar Apify.
3. Handler responde rápido com `{ jobId, status: "queued" }`; execução longa
   roda via `after()` com `executeSearchJob`.
4. Falhas externas retornam 502 amigável, sem expor detalhes internos do actor,
   e usam `apiErrorResponse()` para log estruturado.
5. Handler Apify exporta `maxDuration = 300`.

## Arquivos

| Path | Propósito |
|---|---|
| `route.ts` | `POST /api/apify/google-maps` |

## Dependências

- `@/lib/supabase/server`
- `@/lib/api/errors`
- `@/lib/validators/search`
- `@/lib/apify/run-and-persist`
- `@/lib/apify/google-maps`
- `@/lib/env`
