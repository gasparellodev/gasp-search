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
5. **`globals.css` é o único lugar onde tokens de design (CSS variables) vivem.** Componentes consomem via classes Tailwind (`bg-primary`, `text-foreground`). Tokens seguem Apple SK ("Storekit"): paleta blue (`#0071e3`), neutros warm (foreground `#1d1d1f`), card alabaster (`#f5f5f7`). Aditivos `--sk-*` (button-bg-hover, link, card-radius, accent-orange, focus-ring) cobrem o que shadcn não modela.
6. **Light mode é default** (`<ThemeProvider defaultTheme="light">`). Apple SK é fundamentalmente light-first; dark é swap fiel ao `.theme-dark` da Apple. Toggle vem via Topbar, persistido em localStorage pelo `next-themes`; reflete na classe do `<html>`.
7. **`fetch`/`createServerClient` em Server Components** que dependem do usuário precisam de `cache: 'no-store'`.
8. **Raiz `/` não renderiza landing**: sempre redireciona para `/login` sem
   sessão ou `/dashboard` com sessão.

## Arquivos

| Path | Propósito |
|---|---|
| `layout.tsx` | Root layout: Inter (variável `--font-inter`, fallback do stack SF Pro), lang `pt-BR`, **light default**, metadata padrão |
| `page.tsx` | Redirect da raiz: sem sessão → `/login`; logado → `/dashboard` |
| `globals.css` | Imports Tailwind 4, design tokens Apple SK (hex), tokens premium Auto Showroom escopados em `[data-theme="auto-showroom"]` (`--auto-*` + `--z-header` / `--z-floating-cta` / `--z-installment-bar`), fallback CSS do header glass para browsers sem `backdrop-filter`, `@custom-variant dark`, layer base, e `@layer utilities` com escala tipográfica `.sk-h1`..`.sk-body-sm` |
| `api/apify/google-maps/route.ts` | API protegida que dispara busca Google Maps no Apify |
| `api/ai/generate-message/route.ts` | API protegida que gera mensagem IA para um lead e persiste em `lead_messages` |
| `api/dashboard/route.ts` | API protegida que retorna métricas e últimas buscas para `/dashboard` |
| `robots.ts` | **SEO infra (#212).** Next Metadata file que gera `/robots.txt`. Universal `*` com `disallow` das rotas internas autenticadas (`/api/`, `/login`, `/dashboard/`, `/leads/`, `/messages/`, `/campaigns/`, `/pipeline/`, `/search/`); allow explícito para 11 AI bots (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `ChatGPT-User`, `GoogleOther`, `Google-Extended`, `Bytespider`, `CCBot`, `anthropic-ai`, `cohere-ai`, `FacebookBot`) + `Bingbot`; `sitemap` URL absoluto + `host` hint canônico. Estático (NEXT_PUBLIC_APP_URL é build-time). **Baseline AI crawler allowlist 2026-05; revisar trimestralmente** conforme novos LLMs entrarem no mercado. |
| `sitemap.ts` | **SEO infra (#212).** Next Metadata file dinâmico que gera `/sitemap.xml`. Chama `listIndexableSites()` (sem `'use cache'` directive) e expande para 5 URLs estáticas + N car-detail URLs por site: home (1.0), `/estoque` (0.9), `/sobre` + `/contato` (0.7), `/anunciar` (0.6) + `/estoque/[carSlug]` (0.8 weekly, extraído de `variables.cars[]` via `SiteVariablesV2.safeParse`; máximo 6 por site). Parse failure → `console.warn` + skip apenas car URLs do site afetado (mantém as 5 estáticas). `export const revalidate = 3600` (ISR 1h). Graceful global: em erro inesperado retorna `[]` (sitemap vazio = válido per protocol). |

> Conforme features chegam: `(auth)/login`, `(auth)/callback`, `(app)/layout`, `(app)/dashboard`, `(app)/search`, `(app)/leads`, `(app)/pipeline`, `api/leads`, `api/dashboard`, `api/apify/*`, `api/ai/*`.

## Dependências

- `next/font/google` (Inter como fallback web; macOS/iOS pegam SF Pro nativo via `-apple-system` no stack)
- `@/components/ui/*` (shadcn)
- `@/lib/supabase/server` para auth checks
- `@/lib/env` validado no boot
