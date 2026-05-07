# `app/` — Spec Técnica

## Propósito

App Router do Next.js. Contém todas as rotas (públicas, autenticadas), layouts, route handlers (API), e o root layout com fonte/metadata global.

## Como adicionar

- **Rota pública**: arquivo em `app/<rota>/page.tsx` (Server Component por default).
- **Rota protegida**: arquivo em `app/(app)/<rota>/page.tsx`. O layout `(app)/layout.tsx` faz auth check via `auth.getUser()` e redireciona não-logado para `/login`.
- **Rota de auth**: arquivo em `app/(auth)/<rota>/page.tsx`. Sem auth check.
- **API route**: arquivo em `app/api/<recurso>/route.ts` exportando `GET`/`POST`/`PATCH`/`DELETE`. Validar body com Zod. Para Apify síncrono use `export const maxDuration = 300`.
- **Server Action**: função `'use server'` em `actions.ts` no mesmo segmento da rota.

## Regras de negócio

1. **Server Components por default.** Adicione `'use client'` apenas quando precisar de estado, handlers, ou hooks de cliente (ex.: `useForm`, `useDnd`).
2. **Auth gate é responsabilidade do layout `(app)`**, não de cada page. O middleware (`/middleware.ts`) garante o redirect; o layout valida a sessão para Server Components abaixo dele.
3. **Toda mutation dispara toast** via `sonner` no Client Component que invocou.
4. **Toda lista tem skeleton + empty state desenhado** (não deixar tela em branco).
5. **`globals.css` é o único lugar onde tokens de design (CSS variables) vivem.** Componentes consomem via classes Tailwind (`bg-primary`, `text-foreground`).
6. **Dark mode é default** (`<html className="dark">`). Toggle vai vir via Topbar, persistido em localStorage; refletido na classe do `<html>`.
7. **`fetch`/`createServerClient` em Server Components** que dependem do usuário precisam de `cache: 'no-store'`.

## Arquivos

| Path | Propósito |
|---|---|
| `layout.tsx` | Root layout: Inter + JetBrains Mono, lang `pt-BR`, dark default, metadata padrão |
| `page.tsx` | Landing temporária; será substituída pelo redirect para `/dashboard` em #11 |
| `globals.css` | Imports Tailwind 4, design tokens (oklch), dark variant, layer base |
| `api/apify/google-maps/route.ts` | API protegida que dispara busca Google Maps no Apify |
| `api/ai/generate-message/route.ts` | API protegida que gera mensagem IA para um lead e persiste em `lead_messages` |

> Conforme features chegam: `(auth)/login`, `(auth)/callback`, `(app)/layout`, `(app)/dashboard`, `(app)/search`, `(app)/leads`, `(app)/pipeline`, `api/leads`, `api/apify/*`, `api/ai/*`.

## Dependências

- `next/font/google` (Inter, JetBrains Mono)
- `@/components/ui/*` (shadcn)
- `@/lib/supabase/server` para auth checks
- `@/lib/env` validado no boot
