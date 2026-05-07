# `app/api/dashboard/` — Spec Técnica

## Propósito

Endpoint REST protegido para alimentar o dashboard client-side.

## Endpoint

### `GET /api/dashboard`

Valida sessão via `createServerSupabase().auth.getUser()` e retorna
`DashboardSummary` de `lib/dashboard/summary`.

**Response:** `200 DashboardSummary`.

Erros: `401 Não autenticado`, `502 Falha ao carregar dashboard`.

## Regras de negócio

1. `/api/*` não passa pelo `proxy.ts`; o handler sempre faz auth check próprio.
2. Não cachear resposta (`cache-control: no-store`), pois o dashboard atualiza
   ao focar a janela.
3. A rota não faz query direta; delega para `getDashboardSummary`.
4. Falhas inesperadas passam por `apiErrorResponse()` para log estruturado
   com `requestId`, `route` e `userId`, sem expor stack ao cliente.

## Dependências

- `@/lib/supabase/server`
- `@/lib/dashboard/summary`
- `@/lib/api/errors`
