# `app/(auth)/` — Spec Técnica

## Propósito

Route group para fluxos de autenticação. Rotas aqui são **públicas** (não exigem sessão) — `proxy.ts` whitelista `/login`, `/callback`, e prefixo `/auth/`.

## Estrutura

```
(auth)/
├── login/page.tsx     # Tabs Entrar/Cadastrar + Google OAuth (Client Component)
└── callback/route.ts  # OAuth code exchange + email confirmation (Route Handler)
```

`(auth)` é um route group: o segmento entre parênteses não aparece na URL. `app/(auth)/login/page.tsx` → `/login`.

## Como adicionar

- **Nova rota de auth** (e.g., `/forgot-password`): pasta nova em `(auth)/<rota>/page.tsx`. Adicionar a rota a `PUBLIC_PATHS` em `lib/supabase/middleware.ts`.
- **Nova provedora OAuth**: adicionar handler em `(auth)/callback/route.ts` ou criar rota dedicada se o flow for distinto.
- **Server Action de auth**: arquivo `actions.ts` no segmento, função `'use server'`.

## Regras de negócio

1. **Forms validados via Zod** (`lib/validators/auth.ts`). Mensagens em PT-BR.
2. **Senha mínima 8 caracteres** (alinhado ao default do Supabase Auth).
3. **OAuth `redirectTo`** sempre relativo ao `publicEnv.NEXT_PUBLIC_APP_URL` — sem hardcode de host.
   - **Guard contra open redirect (#138b).** `callback/route.ts` aceita o
     query param `redirectTo` APENAS se for path relativo (`/...`) com mais
     de um char, **rejeitando** `//evil.com` (protocol-relative), `/\evil.com`
     (browsers normalizam `\` → `/`) e qualquer URL absoluta. Fallback é
     `/dashboard`. Sem isso, um atacante consegue exfiltrar a sessão recém
     emitida ao linkar `…/callback?redirectTo=//evil.com`.
4. **Erros do Supabase** vão para toast (`sonner`) E `?error=...` na URL para casos de redirect.
5. **`emailRedirectTo` no signUp** aponta para `/callback` para confirmar e-mail antes de ativar.
6. **Após sign-in com sucesso**: `router.push(redirectTo)` + `router.refresh()` para revalidar Server Components com a nova sessão.

## Arquivos

| Path | Propósito |
|---|---|
| `login/page.tsx` | Client Component com tabs (Entrar/Cadastrar) + Google OAuth |
| `callback/route.ts` | Route handler para OAuth code exchange e email confirmation |

## Dependências

- `@supabase/ssr` (server client no callback)
- `@/lib/supabase/client` (browser client na login page)
- `@/lib/validators/auth` (Zod schemas)
- `@/lib/env`, `@/lib/env-public`
- `react-hook-form` + `@hookform/resolvers`
- `sonner` (toast)

## Quando atualizar este `CLAUDE.md`

- Nova rota de auth.
- Mudança no fluxo OAuth (provider novo, MFA, etc.).
- Adição de Server Actions no segmento.
