# Gasp Search — Handoff Doc

> Documento de handoff para retomar o desenvolvimento do projeto. Escrito ao final da sessão de bootstrap (Fase 0 + Fase 1 + parte da Fase 2 entregues). Use este doc como ponto de entrada para qualquer agente (Codex, Claude, Cursor, etc.) ou desenvolvedor humano que continue o trabalho.

---

## Estado em 7 de maio de 2026

### Mergeado em `main` (15 PRs)

| # | Tema | PR |
|---|---|---|
| Phase 0 | Repo + CI workflow | #41 |
| Phase 0 | PR/Issue templates + CODEOWNERS | #43 |
| Phase 0 | CONTRIBUTING.md | #44 |
| #5 | Bootstrap Next.js 16 + shadcn | #45 |
| #6 | Setup Vitest + Playwright | #46 |
| #7 | Env validator (Zod, server-only) | #47 |
| #8 | Migration SQL + types/database.ts | #48 |
| #9 | Supabase clients + auth gate (proxy.ts) | #49 |
| #10 | /login (email + Google) + /callback | #50 |
| #11 | App shell (Sidebar/Topbar/ThemeToggle) | #51 |
| #12 | shadcn primitives mínimos | #52 |
| #13 | Apify client + runAndPersist util | #53 |
| #14 | Google Maps mapper + normalizeWebsite | #54 |

### Métricas

- **76 unit tests** verdes, **5 e2e tests** verdes
- **Coverage**: 93% lines, 76% branches em scope (`lib/`, `app/api/`, `components/{layout,search,leads,pipeline,ai}/`)
- **CI**: 5 status checks (`lint`, `typecheck`, `unit`, `e2e`, `build`) — todos verdes
- **Branch protection** ativa em `main`, squash-only

### Issues abertas (26 restantes)

Veja `gh issue list --state open --limit 30` para o backlog completo.

| Phase | Range | Tema |
|---|---|---|
| 2 — Search Engine | #15–#28 | API GMaps, página /search, tabela de leads, filtros, drawer, tags, Instagram, enriquecimento |
| 3 — CRM Tools | #29–#35 | Kanban, IA (Anthropic), CSV export, dashboard |
| 4 — Polish | #36–#40 | Skeletons, toasts, error UX, README, audit |
| Follow-up | #42 | Pin actions por SHA + permissions block (security) |

> **Importante:** issue #6 (TaskList interno) é "Apply migration 0001_init.sql no Supabase" — precisa ser executado **manualmente** pelo dono do projeto antes que `auth` funcione end-to-end. Veja seção "Manual Steps" abaixo.

---

## Convenções (LEIA antes de começar)

### Documentação como código

1. **Cada pasta com arquivos tem `CLAUDE.md`** descrevendo: propósito, como adicionar, regras de negócio, arquivos, dependências.
2. Antes de tocar uma área, **leia** o `CLAUDE.md` daquela pasta.
3. Ao adicionar arquivos a uma pasta, **atualize** o `CLAUDE.md` correspondente.
4. Pastas que **devem** ter CLAUDE.md hoje:
   - `/CLAUDE.md` (raiz — visão geral, stack, regras nucleares)
   - `app/CLAUDE.md`, `app/(auth)/CLAUDE.md`, `app/(app)/CLAUDE.md`
   - `components/CLAUDE.md`, `components/ui/CLAUDE.md`, `components/layout/CLAUDE.md`
   - `lib/CLAUDE.md`, `lib/supabase/CLAUDE.md`, `lib/apify/CLAUDE.md`
   - `supabase/CLAUDE.md`, `supabase/migrations/CLAUDE.md`
   - `tests/CLAUDE.md`, `tests/stubs/CLAUDE.md`
   - `types/CLAUDE.md`
   - `.github/CLAUDE.md`

### Quality gates por PR (não-negociáveis)

Detalhado em [`CONTRIBUTING.md`](./CONTRIBUTING.md). Resumo:

1. Branch `<type>/<issue#>-<slug>` a partir de `main`.
2. **TDD**: teste falhando antes da implementação.
3. `npm run lint && npx tsc --noEmit && npm test && npm run test:e2e` localmente.
4. PR com `Closes #N` no body.
5. CI verde (5 jobs).
6. Code review + security review (use as skills `sentry-skills:code-review` e `sentry-skills:security-review` se disponível, ou siga checklists OWASP/Sentry no [`CONTRIBUTING.md`](./CONTRIBUTING.md)).
7. Squash merge.

### Cobertura mínima

Configurada em `vitest.config.ts`:

- **80%** lines / functions / statements
- **75%** branches

Em `lib/` e `app/api/` (e composições em `components/{layout,search,leads,pipeline,ai}/`). Pages, layouts e shadcn primitives **estão excluídos** do scope — eles são cobertos por E2E (Playwright).

---

## Stack — versões reais

| Camada | Versão |
|---|---|
| Next.js | 16.2.5 (App Router, Turbopack) |
| React | 19.2.4 |
| TypeScript | 5 (strict + `noUncheckedIndexedAccess`) |
| Tailwind | 4 (CSS-first com `@theme inline`, sem `tailwind.config.ts`) |
| shadcn/ui | 4.7+ (radix base, oklch tokens) |
| Supabase | `@supabase/ssr` 0.10.x + `@supabase/supabase-js` 2.105.x |
| Apify | `apify-client` 2.23.x |
| Anthropic | `@anthropic-ai/sdk` 0.95.x — modelo `claude-sonnet-4-6` |
| Forms | `react-hook-form` 7.75 + `zod` 4.4 + `@hookform/resolvers` 5.2 |
| Tabelas | `@tanstack/react-table` 8.21 |
| DnD | `@dnd-kit/core` 6.3 + `@dnd-kit/sortable` 10 |
| Tests | Vitest 4 + RTL 16 + Playwright |
| Auth UX | `next-themes` 0.4 |

> Convenção **Next 16**: arquivo de middleware na raiz se chama `proxy.ts` (não `middleware.ts`), exporta `proxy()`.

---

## Estrutura mental

```
app/
├── (auth)/           # rotas públicas — login, callback (proxy.ts whitelist)
├── (app)/            # rotas autenticadas — layout faz auth check + monta shell
│   ├── layout.tsx    # Server: auth + lê profile + Sidebar + Topbar
│   ├── dashboard/    # cards (placeholder real chega em #35)
│   ├── search/       # form de busca (#16)
│   ├── leads/        # tabela + filtros + drawer (#18-#20)
│   ├── pipeline/     # Kanban dnd-kit (#29)
│   └── settings/     # placeholder
├── api/              # route handlers REST (sem proxy — handlers validam auth próprio)
│   ├── apify/{google-maps,instagram,enrich}/
│   ├── leads/[id]/
│   ├── leads/export/
│   └── ai/generate-message/
├── layout.tsx        # ThemeProvider + Toaster + Inter/JetBrains
└── page.tsx          # landing (logado redireciona para /dashboard via proxy)

lib/
├── apify/            # client + runAndPersist + mappers por source
├── supabase/         # server.ts (cookies), client.ts (browser), middleware.ts (auth gate)
├── ai/               # anthropic.ts (#30)
├── validators/       # zod schemas (auth.ts pronto; search.ts e lead.ts pendentes)
├── env.ts            # server-only loader (10 envs validadas)
├── env-public.ts     # client-safe (3 NEXT_PUBLIC_*)
└── utils.ts          # cn() helper

components/
├── layout/           # sidebar, topbar, theme-toggle, user-menu
└── ui/               # 25 shadcn primitives (não editar; gerados pelo CLI)

supabase/migrations/  # SQL versionado (forward-only)
types/database.ts     # gerado por supabase gen types (hoje hand-written)
tests/                # unit/ + e2e/ + fixtures/ + stubs/
proxy.ts              # auth gate Next 16 (era middleware.ts)
```

---

## Manual Steps (faça antes de continuar)

### 1. Aplicar a migration no Supabase

```bash
# Opção A: Dashboard SQL Editor
# 1. Abra https://supabase.com/dashboard/project/pvazzozzqwwshgacmafv/sql/new
# 2. Cole o conteúdo de supabase/migrations/0001_init.sql
# 3. Run

# Opção B: Supabase CLI (precisa de db password no .env)
npx supabase login
npx supabase link --project-ref pvazzozzqwwshgacmafv
npx supabase db push
```

Validar:
```sql
select tablename from pg_tables where schemaname='public';
-- esperado: profiles, tags, search_jobs, leads, lead_tags, lead_messages
```

### 2. Regenerar `types/database.ts` após migration

```bash
npx supabase gen types typescript --project-id pvazzozzqwwshgacmafv > types/database.ts
```

> O arquivo atual foi escrito à mão para refletir a migration. Após `gen types`, formato pode variar levemente. Verifique `npx tsc --noEmit` ainda passa.

### 3. Configurar Google OAuth no Supabase

Dashboard → Authentication → Providers → Google → habilitar e colar `client_id`/`client_secret` que você já tem. Definir `Authorized redirect URI` como `https://pvazzozzqwwshgacmafv.supabase.co/auth/v1/callback`.

### 4. Configurar GitHub Secrets para CI E2E real

```bash
gh secret set NEXT_PUBLIC_SUPABASE_URL
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY
gh secret set SUPABASE_SERVICE_ROLE_KEY
gh secret set APIFY_TOKEN
gh secret set ANTHROPIC_API_KEY
```

> CI funciona hoje com placeholders (smoke E2E não toca Supabase real). Ao adicionar testes E2E que precisam de auth real, os secrets passam a ser obrigatórios.

### 5. (Opcional) Endurecer security do CI workflow

Implementar issue **#42** (pin de actions por SHA + bloco `permissions: contents: read`) **antes** de adicionar secrets sensíveis ao repo público.

---

## Próximos passos sugeridos (ordem recomendada)

### Fase 2 (Search Engine) — 14 issues

1. **#15** API `POST /api/apify/google-maps` — handler que valida body + chama `runAndPersist` + retorna `{ jobId, status, leadsCount }`. Use `lib/apify/run-and-persist.ts` + `lib/apify/google-maps.ts` já prontos. Adicione `export const maxDuration = 300`.
2. **#16** Página `/search` — Form com tabs (GMaps/Instagram), inputs de termos (chip) + cidade/estado. RTL + E2E.
3. **#17** Componente `SearchProgress` — spinner + tempo + nome do actor.
4. **#18** Página `/leads` — TanStack Table + paginação server-side. Substitui placeholder.
5. **#19** `FiltersBar` — sincronizado com URL searchParams.
6. **#20** `LeadDetailDrawer` — sheet com tabs.
7. **#21** API `/api/leads`, `/api/leads/[id]` — GET/PATCH/DELETE.
8. **#22** Tags CRUD + Combobox.
9. **#23–#28** Instagram + Enrichment (mesmo padrão da fonte 1).

### Fase 3 (CRM Tools) — 7 issues

10. **#29** Kanban `/pipeline` com `@dnd-kit`.
11. **#30** `lib/ai/anthropic.ts` — usar prompt caching, `claude-sonnet-4-6`.
12. **#31** API `/api/ai/generate-message`.
13. **#32–#33** UI da geração + histórico.
14. **#34** CSV export.
15. **#35** Dashboard real (substitui placeholder).

### Fase 4 (Polish) — 5 issues

16. **#36–#40** Skeletons, toasts consistentes, error UX, README, audit final.

---

## Dicas para Codex (ou qualquer agente AI)

### Antes de qualquer mudança

```bash
git fetch && git checkout main && git pull --ff-only
gh issue list --state open --limit 50
```

Escolha uma issue, leia descrição. Veja relacionados:

```bash
gh issue view <N>
```

### Workflow recomendado de PR

```bash
gh issue view <N>                                 # leia critérios
git checkout -b feat/<N>-<slug>                   # branch
# escreva test em tests/unit/... que falha (RED)
npm test -- tests/unit/<arquivo>                  # confirma falha
# implemente em lib/... ou app/...
npm test -- tests/unit/<arquivo>                  # confirma passa (GREEN)
npm run lint && npx tsc --noEmit && npm test && npm run test:e2e
# atualize CLAUDE.md de pastas que receberam arquivos
git add -A && git commit -m "feat(area): descrição (#N)"
git push -u origin feat/<N>-<slug>
gh pr create --title "feat(area): ..." --body "...Closes #N..."
# espere CI
# rode code-review + security-review (mental ou via sentry-skills)
# documente reviews como comment no PR
gh pr merge <PR#> --squash --delete-branch
git checkout main && git pull --ff-only
```

### Padrões a manter

- **Server Components por default**, `'use client'` só onde precisa de hooks de cliente.
- **Server-only modules** (`lib/env.ts`, `lib/supabase/server.ts`, `lib/apify/*`, `lib/ai/*`) começam com `import "server-only"`.
- **Validators Zod** ficam em `lib/validators/<area>.ts`.
- **Mappers Apify**: puros, testáveis sem mock de Apify. Recebem `(item, ctx)` e retornam `LeadInsert | null`.
- **API handlers** que chamam Apify: `export const maxDuration = 300;`.
- **Toda mutation dispara toast** via `sonner` no Client Component.
- **Toda lista tem skeleton + empty state desenhado**. Sem tela em branco.
- **Dark mode default**, toggle via `next-themes`.
- **Português em UI** (PT-BR), inglês em código (identificadores, mensagens de log).

### Arquivos para ter como referência

| Coisa que estou implementando | Look at |
|---|---|
| API handler com auth + body validation | (não há ainda; criar pattern em #15) |
| Apify mapper | `lib/apify/google-maps.ts` |
| Server Action / fetch via Supabase | `app/(app)/layout.tsx` (linhas com `supabase.from(...)`) |
| Form + Zod + RHF + toast | `app/(auth)/login/page.tsx` |
| Componente client com `useTheme` SSR-safe | `components/layout/theme-toggle.tsx` |
| Tests RTL com mock de Supabase | `tests/unit/components/layout/user-menu.test.tsx` |
| Tests handler/server-only | `tests/unit/lib/supabase/middleware.test.ts` |
| Tests mapper Apify | `tests/unit/lib/apify/google-maps.test.ts` |

### Coverage tips

- Se um arquivo novo cair abaixo do threshold global, rodar `npm test -- --coverage` localmente **antes** de pushar (CI roda com `--coverage`).
- shadcn primitives em `components/ui/` são gerados — **não** estão no scope. Não tente cobrir.
- Pages e layouts **não** estão no scope unit — cobre via Playwright E2E.

---

## Referências essenciais

- **CLAUDE.md raiz** — regras nucleares + stack + quality gates
- **CONTRIBUTING.md** — fluxo de PR de 12 passos + comandos
- **`<pasta>/CLAUDE.md`** — regras locais por área
- **AGENTS.md** — aviso oficial do Next 16 (gerado pelo create-next-app) sobre breaking changes vs training data
- **Plano detalhado original** (não commitado): `~/.claude/plans/gasp-search-serialized-forest.md`

---

## Contato e contexto

- **Owner**: `gasparellodev` (gasplab.com)
- **Repo**: https://github.com/gasparellodev/gasp-search (público)
- **Supabase Project**: `pvazzozzqwwshgacmafv`
- **Stack atual**: validada localmente em macOS (Darwin 25.3.0, Node 24.14.1)

Boa próxima sessão. 🚀
