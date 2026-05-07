# `app/api/apify/google-maps/` — Spec Técnica

## Propósito

Route handler protegido para disparar busca síncrona no actor Google Maps do Apify e persistir leads no Supabase.

## Regras de negócio

1. Auth é obrigatória via `createServerSupabase().auth.getUser()`.
2. Body é validado por `searchGoogleMapsSchema` antes de chamar Apify.
3. `runAndPersist` cria `search_jobs`, executa actor, mapeia dataset e faz upsert de leads.
4. Falhas externas retornam 502 amigável, sem expor detalhes internos do actor.
5. Handler Apify síncrono exporta `maxDuration = 300`.

## Arquivos

| Path | Propósito |
|---|---|
| `route.ts` | `POST /api/apify/google-maps` |

## Dependências

- `@/lib/supabase/server`
- `@/lib/validators/search`
- `@/lib/apify/run-and-persist`
- `@/lib/apify/google-maps`
- `@/lib/env`
