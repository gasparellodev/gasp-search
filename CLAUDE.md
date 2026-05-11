# Gasp Search — Spec Técnica do Projeto

## Propósito

Aplicação web interna do GaspLab para captação, qualificação e gestão de leads de desenvolvimento de sites e automação. Substitui planilhas e processos manuais por um fluxo único: **buscar → enriquecer → qualificar → contatar**.

## Stack

| Camada | Tecnologia (real) |
|---|---|
| Framework | Next.js 16 App Router (Turbopack) + TypeScript strict + `noUncheckedIndexedAccess` |
| Runtime | Node 24 LTS |
| UI | React 19 + shadcn/ui + Tailwind v4 (CSS-first) + Radix |
| Auth & DB | Supabase (Postgres + Auth + RLS) |
| Scraping | Apify (`apify-client`) |
| IA | Anthropic SDK (`claude-sonnet-4-6`) |
| Forms | `react-hook-form` + `zod` v4 |
| Tabelas | `@tanstack/react-table` v8 |
| Drag & drop | `@dnd-kit/core` + `@dnd-kit/sortable` v10 |
| Testes | Vitest + React Testing Library + Playwright (issue #6) |

Sem Redux, sem TanStack Query no MVP. Server Components + Server Actions são suficientes.

> **Stack atualizado vs spec original.** Spec foi escrito assumindo Next.js 14.2 / React 18 / Tailwind 3.4. O bootstrap ficou no que `create-next-app` entrega hoje (Next 16, React 19, Tailwind 4) — satisfaz "14.2+" do spec e alinha com o knowledge update do plugin Vercel. Tailwind v4 muda config para CSS (`@theme inline { ... }` em `globals.css`), sem `tailwind.config.ts`. Dark mode via `@custom-variant dark (&:is(.dark *))` + classe `.dark` no `<html>`.

## Estrutura de pastas (alvo)

```
app/                # App Router: rotas (auth) e (app) protegidas
  api/              # Route handlers REST
components/         # UI components (ui/, layout/, search/, leads/, pipeline/, ai/)
lib/                # Server-side utilities (supabase, apify, ai, validators)
types/              # Tipos do domínio + tipos gerados do Supabase
supabase/migrations # SQL versionado
tests/              # Unit + E2E
.github/            # Workflows e templates
```

Cada pasta com arquivos **DEVE** conter um `CLAUDE.md` documentando: propósito, regras para adicionar, regras de negócio, arquivos/funções e dependências.

## Regras de negócio (núcleo)

1. **Multi-tenant por usuário.** Toda tabela referencia `user_id`; RLS isola dados. Nenhuma query bypassa RLS exceto onde explicitamente `service_role` é usado (server-only, jamais no client).
2. **Dedup de leads.** Unique `(user_id, source, website)` e `(user_id, source, instagram_handle)`. Mappers normalizam `website` (lower, sem protocolo, trim) e `instagram_handle` (sem `@`, lower).
3. **Pipeline de estágios.** `new → contacted → in_conversation → qualified → closed_won | closed_lost`. Movimentos via PATCH `/api/leads/[id]`.
4. **Buscas síncronas.** API routes usam `apify.actor(...).call()` (timeout 5min via `maxDuration = 300`). Para V2, migrar para `start()` + polling.
5. **Mensagens IA não-determinísticas.** Cada geração persiste em `lead_messages`; histórico é fonte da verdade. Sem cache local.
6. **Tokens server-only.** `APIFY_TOKEN`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` jamais expostos no bundle do cliente. Tudo passa por API routes.

## Quality gates (não-negociáveis)

Cada PR deve passar por:

1. **TDD obrigatório** em lógica de negócio (mappers, validators, server actions, handlers).
2. **Lint** (`npm run lint`) zero warnings.
3. **Typecheck** (`npx tsc --noEmit`) zero erros.
4. **Unit tests** (`npm test`) verdes, coverage ≥ 80% lines/functions, ≥ 75% branches em `lib/` e `app/api/`.
5. **E2E tests** (`npm run test:e2e`) verdes para fluxos afetados.
6. **CI verde** em `.github/workflows/ci.yml` (lint + typecheck + unit + e2e + build).
7. **`sentry-skills:code-review`** rodado, achados endereçados.
8. **`sentry-skills:security-review`** rodado, achados endereçados (especial: RLS bypass, secret leaks no bundle, OWASP, injection).
9. **CLAUDE.md** atualizado para toda pasta que recebeu arquivos novos/modificados.
10. **1 review aprovado** + squash merge em `main`.

## Convenções

- **Server Components por padrão.** `'use client'` só onde há estado/handlers.
- **Server Actions** para mutations de UI simples; **API routes REST** para batched ops, exports e webhooks futuros.
- **TypeScript strict + `noUncheckedIndexedAccess`.** Nada de `any` no código final; preferir `unknown` + narrowing.
- **Commits semânticos.** `feat(search): add google maps actor`, `fix(auth): handle missing google metadata`, `chore(ci): bump node`.
- **Branches.** `<type>/<issue#>-<slug>`, ex: `feat/9-supabase-clients`.
- **PRs squash-only** com auto-close via `Closes #N`.
- **Toda async UI dispara toast** via `sonner`.
- **Toda lista tem skeleton + empty state desenhado.** Não deixar tela em branco.
- **Dark mode default.** Toggle no Topbar. Tailwind `darkMode: 'class'`.
- **Acentuação PT-BR em mensagens** ao usuário e `notes`.
- **Mocks de tests** ficam em `tests/__mocks__/` (Supabase, Anthropic, Apify) e fixtures factories em `tests/fixtures/` — ver [`tests/CLAUDE.md` → "Mock factories"](tests/CLAUDE.md). Convenção `make<Entity>(overrides?)` para factories, `createMockX` / `xMock()` para clients externos.

## Variáveis de ambiente

Ver `.env.local.example` para a lista canônica. Todas validadas via Zod em `lib/env.ts`.

| Var | Onde |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only |
| `APIFY_TOKEN` | server-only |
| `ANTHROPIC_API_KEY` | server-only |
| `ANTHROPIC_MODEL` | server-only (default `claude-sonnet-4-6`) |
| `NEXT_PUBLIC_APP_URL` | client + server |
| `EVOLUTION_API_URL` | server-only (default `http://localhost:8080`) |
| `EVOLUTION_API_KEY` | server-only (obrigatório se WhatsApp habilitado) |
| `EVOLUTION_WEBHOOK_SECRET` | server-only (mín 16 chars; obrigatório se WhatsApp habilitado) |
| `NEXT_PUBLIC_WHATSAPP_ENABLED` | client + server (`'0'` \| `'1'`, default `'0'`) |

## Onde está o quê

- **Spec original do produto:** issue/discussão de planejamento (ver issues).
- **Plano detalhado de execução:** `~/.claude/plans/gasp-search-serialized-forest.md` (local; não commitar).
- **Backlog completo:** [issues no GitHub](https://github.com/gasparellodev/gasp-search/issues) distribuídas em 6 milestones (Phase 0–5).
- **Workflow de PR:** `CONTRIBUTING.md`.
- **CI:** `.github/workflows/ci.yml`.
- **Evolution API (dev local):** `docker/evolution/README.md`.

## Como evoluir este `CLAUDE.md`

Atualizá-lo sempre que:
- Stack mudar (versão major, biblioteca trocada).
- Nova regra de negócio nuclear surgir.
- Convenção for revisada.
- Estrutura de pastas mudar.

Manter conciso (< 200 linhas). Detalhes específicos vão para o `CLAUDE.md` da pasta relevante.
