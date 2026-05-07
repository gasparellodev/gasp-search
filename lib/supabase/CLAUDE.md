# `lib/supabase/` — Spec Técnica

## Propósito

Clientes Supabase para os 3 contextos do Next.js: Server Components/Actions, Client Components, e middleware. Cada um lê/escreve cookies de forma diferente.

## Como adicionar

- **Novo helper de query** (e.g., `getCurrentUser`, `getLeadById`): adicionar em arquivo dedicado nesta pasta (`lib/supabase/queries/<nome>.ts`) ou inline em Server Actions/handlers.
- **Schema-aware queries**: sempre tipar com `Database` em `createServerClient<Database>(...)`. Sem isso, retornos perdem tipos.
- **Service role** (bypass RLS): NUNCA usar para operações que tocam dados de usuário em handlers de request. Reserve apenas para jobs de admin/migration.

## Regras de negócio

1. **Cookies por-request**: `createServerSupabase()` cria nova instância em cada chamada. Não cachear em variável de módulo.
2. **`server.ts` é server-only** (`import "server-only"`). Pode ser importado em Server Components, Server Actions, route handlers — nunca em Client Components.
3. **`client.ts` é Client-only** (`"use client"`). Importar em componentes com `"use client"`.
4. **`middleware.ts` é único lugar onde refresh ativo da sessão acontece** em cada request — sem ele, sessão expira e páginas autenticadas falham silenciosamente.
5. **`updateSession` é fonte da verdade do auth gate**. Layout `(app)` faz uma segunda checagem para Server Component que precisa do user — mas a redireção primária é no middleware.
6. **Public paths**: `/login`, `/callback`, `/auth*` nunca exigem sessão. Outros paths (incluindo `/api/*` que NÃO está no matcher) são responsabilidade do consumidor.

## Arquivos

| Path | Propósito |
|---|---|
| `server.ts` | `createServerSupabase()` — cria client com cookies do request via `next/headers` |
| `client.ts` | `createBrowserSupabase()` — cria browser client; usa `publicEnv` |
| `middleware.ts` | `updateSession(req)` — refresh cookie + auth gate; redireciona para `/login` ou `/dashboard` conforme estado |

## Dependências

- `@supabase/ssr`
- `@supabase/supabase-js` (peer)
- `@/lib/env`, `@/lib/env-public`
- `@/types/database`
- `next/headers`, `next/server`

## Quando atualizar este `CLAUDE.md`

- Nova rota pública (adicionar a `PUBLIC_PATHS` em `middleware.ts`).
- Nova convenção de query (e.g., uso de `service_role` para jobs).
- Nova estratégia de invalidação de sessão.
