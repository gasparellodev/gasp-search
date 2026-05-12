# Finalize All Open Issues — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mergear todas as 22 issues abertas do `gasparellodev/gasp-search` + 4 itens adjacentes (Dependabot, branches, HANDOFF, split #138) em 28 PRs distribuídos em 7 waves sequenciais.

**Architecture:** Subagent-driven-development com dispatch paralelo dentro de cada wave. Cada PR segue TDD (red → green → commit), quality gates do CLAUDE.md (lint zero warnings, tsc zero errors, coverage ≥80%/≥75%, E2E afetado, code-review + security-review), squash merge com `Closes #N`.

**Tech Stack:** Next.js 16 + React 19 + TS strict + Supabase + Apify + Anthropic + BullMQ/Redis + Tailwind v4 + Vitest + Playwright. Workflow multi-papel Phase 7: `site-po` → `site-dev` → `site-qa` → `site-reviewer`.

**Spec source:** `docs/superpowers/specs/2026-05-12-finalize-all-open-issues-design.md`

---

## File Structure

Arquivos/pastas que serão criados ou modificados (visão agregada):

**Novos**
- `docker/redis/docker-compose.yml` — Redis 7-alpine local (Wave 0)
- `docker/redis/README.md` — instruções de uso (Wave 0)
- `lib/queue/redis.ts` — singleton ioredis client (#122)
- `lib/queue/campaigns.ts` — Queue\<CampaignTargetJob\> (#122)
- `lib/queue/worker.ts` — worker concorrência respeitando throttle (#122)
- `lib/queue/CLAUDE.md` — documenta lib/queue/ (#122)
- `lib/leads/stage-presentation.ts` — STAGE_LABEL/STAGE_VARIANT/STAGE_ACCENT (#135)
- `lib/evolution/phone.ts` — normalizePhone único (#138a)
- `lib/dashboard/insights.ts` — funil + source breakdown (#124)
- `lib/sites/static-map.ts` — Google Static Maps URL builder (#230)
- `lib/sites/find-similar-cars.ts` — algoritmo D3 (#228)
- `lib/sites/detail-faq-templates.ts` — perguntas contextuais (#228)
- `lib/sites/announce.schema.ts` — Zod schemas do 4-step form (#231)
- `lib/sites/upload-tradein-photos.ts` — pipeline Supabase Storage (#231)
- `lib/analytics/track-event.ts` — typed event dispatcher (#233)
- `components/sites/stock/DetailBreadcrumb.tsx` (#226)
- `components/sites/stock/DetailGalleryCinema.tsx` (#226)
- `components/sites/stock/DetailInfoBlock.tsx` (#226)
- `components/sites/stock/DetailSpecGrid.tsx` (#226)
- `components/sites/stock/GalleryLightbox.tsx` (#226)
- `components/sites/stock/DetailPriceBlock.tsx` (#227)
- `components/sites/stock/DetailFinancingCalcInline.tsx` (#227)
- `components/sites/stock/DetailTrustBadges.tsx` (#227)
- `components/sites/stock/DetailCtaStack.tsx` (#227)
- `components/sites/stock/DetailTradeinWidget.tsx` (#228)
- `components/sites/stock/DetailSimilarVehicles.tsx` (#228)
- `components/sites/stock/DetailFaqVehicle.tsx` (#228)
- `components/sites/about/AboutHeroEditorial.tsx` (#229)
- `components/sites/about/AboutMissionVision.tsx` (#229)
- `components/sites/about/AboutWarrantyDeepdive.tsx` (#229)
- `components/sites/contact/ContactDualPane.tsx` (#230)
- `components/sites/contact/BusinessHours.tsx` (#230)
- `components/sites/contact/WhatsAppDirectCard.tsx` (#230)
- `components/sites/announce/AnnounceHero.tsx` (#231)
- `components/sites/announce/AnnounceStepper.tsx` (#231)
- `components/sites/announce/AnnounceProcessExplanation.tsx` (#231)
- `components/sites/GA4Tag.tsx` (#233)
- `components/leads/lead-tabs.tsx` — unificado inline/standalone (#136)
- `supabase/migrations/000N_evolution_instance_nanoid_slug.sql` (#130)
- `supabase/migrations/000N_lead_messages_cascade.sql` (#133)
- `tests/visual/figma-baseline/v3/*.png` (12 baselines, #204)
- `tests/visual/sites-routes.spec.ts` (#204)
- `tests/visual/README.md` (#204)
- `docs/ANALYTICS.md` (#233)
- `package.json` script `worker:campaigns` (#122)

**Modificados**
- `HANDOFF.md` (Wave 0)
- `.env.local.example` (Wave 0 e #122 e #230 e #233)
- `lib/env.ts` (`REDIS_URL`, `GOOGLE_MAPS_STATIC_API_KEY`, `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_GSC_VERIFICATION` — adicionados nas issues respectivas)
- `app/api/campaigns/route.ts` (#129, #122, #134)
- `app/api/whatsapp/webhook/route.ts` (#130, #138b)
- `app/api/ai/generate-message/route.ts` (#132, #138c)
- `lib/campaigns/processor.ts` (#131, #122, #138a)
- `lib/evolution/send.ts` (#138a, #138d)
- `lib/evolution/webhook.ts` (#130, #123)
- `lib/messages/list-conversations.ts` (#133)
- `lib/evolution/rate-limit.ts` (#138a)
- `lib/evolution/templates.ts` (#138a)
- `app/(auth)/callback/route.ts` (#138b)
- `lib/validators/leads.ts` (#138d)
- `lib/validators/campaigns.ts` (#129, #134)
- `types/database.ts` (regenerado, #138c)
- `app/(app)/leads/[id]/page.tsx` (#135, #136)
- `components/leads/leads-table.tsx` (#135)
- `components/leads/lead-detail-drawer.tsx` (#135, #136)
- `components/leads/filters-bar.tsx` (#135)
- `components/pipeline/board.tsx` (#135, #137)
- `components/dashboard/dashboard-view.tsx` (#135, #124)
- `components/campaigns/target-status-table.tsx` (#137)
- `app/(app)/messages/[leadId]/page.tsx` (#137)
- `components/messages/conversation-thread.tsx` (#123, #138a)
- `components/whatsapp/instance-card.tsx` (#138a)
- `app/sites/[slug]/estoque/[carSlug]/page.tsx` (#226, #227, #228)
- `app/sites/[slug]/sobre/page.tsx` (#229)
- `app/sites/[slug]/contato/page.tsx` (#230)
- `app/sites/[slug]/anunciar/page.tsx` (#231)
- `app/sites/[slug]/layout.tsx` (#233)
- `components/sites/AboutSection.tsx` (legacy, refactor #229)
- `components/sites/ContactSection.tsx` (legacy, refactor #230)
- `components/sites/AdvertiseSection.tsx` (legacy, refactor #231)
- `components/sites/FloatingInstallmentBar.tsx` (wireup #227)
- Vários `CLAUDE.md` em pastas tocadas

---

## Pre-flight checks (executar antes da Task 0)

- [ ] **Step P1: Verificar working tree limpa e CI verde**

  Run:
  ```bash
  git status
  git checkout main && git pull --ff-only
  gh run list --branch main --limit 1 --json conclusion,status
  ```

  Expected: `working tree clean`, último run `conclusion: success`.

- [ ] **Step P2: Verificar PR #264 (spec) aberto**

  Run:
  ```bash
  gh pr view 264 --json state,mergeable
  ```

  Expected: `state: OPEN`, `mergeable: MERGEABLE`. Mergear o spec antes de prosseguir.

---

## Task 0 — Wave 0: Housekeeping (eu, sem subagents)

**Goal:** Limpar repo, atualizar handoff, subir infra Redis, validar bucket Storage.

**Files:**
- Modify: `HANDOFF.md`
- Create: `docker/redis/docker-compose.yml`
- Create: `docker/redis/README.md`
- Modify: `.env.local.example`

### Step 0.1: Mergear PRs Dependabot

- [ ] **Verificar e mergear #86, #87, #88**

  Run para cada:
  ```bash
  gh pr view 86 --json statusCheckRollup,mergeable
  gh pr diff 86
  gh pr merge 86 --squash --delete-branch
  ```

  Repetir para #87 e #88. Expected: cada merge sucede; branches deletadas.

### Step 0.2: Limpar branches obsoletas

- [ ] **Atualizar refs locais e deletar branches mergeadas**

  Run:
  ```bash
  git fetch --all --prune
  git branch -r --merged origin/main | grep -v 'origin/main\|HEAD' | sed 's|origin/||' | xargs -I {} git push origin --delete {}
  git branch --merged main | grep -v '\*\|main' | xargs -n1 git branch -d
  git branch -a | wc -l
  ```

  Expected: count de branches cai significativamente (de ~50 para ~10-15).

### Step 0.3: Atualizar HANDOFF.md

- [ ] **Substituir Sect. "Estado em 7 de maio de 2026" por estado atual**

  Coletar dados:
  ```bash
  TOTAL_MERGED=$(gh pr list --state merged --json number | jq length)
  PHASE6_OPEN=$(gh issue list --state open --milestone "Phase 6 — Local hardening & Insights" --json number | jq length)
  PHASE6_CLOSED=$(gh issue list --state closed --milestone "Phase 6 — Local hardening & Insights" --json number | jq length)
  PHASE7_OPEN=$(gh issue list --state open --milestone "Phase 7 — Site Generator (Concessionárias)" --json number | jq length)
  PHASE7_CLOSED=$(gh issue list --state closed --milestone "Phase 7 — Site Generator (Concessionárias)" --json number | jq length)
  echo "merged: $TOTAL_MERGED, P6: $PHASE6_CLOSED closed / $PHASE6_OPEN open, P7: $PHASE7_CLOSED closed / $PHASE7_OPEN open"
  ```

  Editar `HANDOFF.md`:
  - Substituir tabela "Mergeado em main (15 PRs)" por contagem real.
  - Substituir bloco "Issues abertas (26 restantes)" por estado Phase 6/7 atual.
  - Adicionar nova seção "Plano ativo": link para `docs/superpowers/specs/2026-05-12-finalize-all-open-issues-design.md` e `docs/superpowers/plans/2026-05-12-finalize-all-open-issues-plan.md`.
  - Remover "Próximos passos sugeridos" (Fase 2/3/4) — substituir por link para o spec.

### Step 0.4: Criar Redis Docker

- [ ] **Criar `docker/redis/docker-compose.yml`**

  Conteúdo:
  ```yaml
  services:
    gasp-search-redis:
      image: redis:7-alpine
      container_name: gasp-search-redis
      ports:
        - "6380:6379"
      volumes:
        - redis-data:/data
      restart: unless-stopped
      command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
      healthcheck:
        test: ["CMD", "redis-cli", "ping"]
        interval: 10s
        timeout: 5s
        retries: 5

  volumes:
    redis-data:
  ```

- [ ] **Criar `docker/redis/README.md`**

  Conteúdo:
  ```markdown
  # Redis local (gasp-search)

  Redis 7-alpine na porta `6380` (host) → `6379` (container). Não conflita com `gasp-evolution-redis` em `docker/evolution/` (também 6379 interno, mas container isolado).

  ## Subir

  \`\`\`bash
  cd docker/redis
  docker compose up -d
  docker compose ps
  redis-cli -p 6380 ping
  # esperado: PONG
  \`\`\`

  ## Configuração

  Append-only persistence ligado (`--appendonly yes`).
  Maxmemory 256MB com policy `allkeys-lru`.
  Volume nomeado `redis-data` para durabilidade entre restarts.

  ## Uso

  - `lib/queue/redis.ts` (issue #122) consome `REDIS_URL=redis://localhost:6380`.
  - `lib/queue/campaigns.ts` registra Queue\<CampaignTargetJob\>.
  - `npm run worker:campaigns` inicia worker que processa jobs.

  Não usar em produção como está; ver `lib/queue/CLAUDE.md`.
  ```

- [ ] **Subir e validar**

  Run:
  ```bash
  cd docker/redis && docker compose up -d && cd ../..
  redis-cli -p 6380 ping
  ```

  Expected: `PONG`.

- [ ] **Adicionar env**

  Editar `.env.local.example`, adicionar bloco:
  ```
  # Redis para BullMQ (issue #122) — porta 6380 para não conflitar com Evolution
  REDIS_URL=redis://localhost:6380
  ```

  **NÃO** tocar `lib/env.ts` — isso é parte do PR do #122 (com TDD).

### Step 0.5: Validar bucket Supabase `tradein-photos`

- [ ] **Listar buckets via Supabase MCP**

  Invocar `plugin-supabase-supabase` MCP tool `list_buckets`. Procurar bucket `tradein-photos`.

  Se existir:
  - Invocar `list_policies` no bucket. Confirmar policies: INSERT/SELECT/UPDATE/DELETE restritos a `service_role` (não `anon`, não `authenticated`).
  - Se policy `public read` existir: removê-la.

  Se ausente:
  - Invocar `create_bucket` com `name: 'tradein-photos'`, `public: false`.
  - Criar policies SQL via migration nova `supabase/migrations/000N_tradein_photos_bucket.sql`:
    ```sql
    -- Bucket tradein-photos: service_role-only, signed URLs
    insert into storage.buckets (id, name, public)
    values ('tradein-photos', 'tradein-photos', false)
    on conflict (id) do nothing;

    create policy "service_role can manage tradein-photos"
    on storage.objects for all
    to service_role
    using (bucket_id = 'tradein-photos')
    with check (bucket_id = 'tradein-photos');
    ```
  - Aplicar via Supabase MCP `apply_migration`.

  Documentar resultado em `docs/superpowers/reports/2026-05-12-tradein-photos-bucket-validation.md`.

### Step 0.6: Commit Wave 0

- [ ] **Criar branch chore/wave-0-housekeeping e commit**

  Run:
  ```bash
  git checkout -b chore/wave-0-housekeeping
  git add HANDOFF.md docker/redis/ .env.local.example
  git commit -m "chore(wave-0): housekeeping — redis docker + handoff update + env

  - Adiciona docker/redis/docker-compose.yml (porta 6380)
  - Atualiza HANDOFF.md com estado real Phase 6/7
  - Documenta REDIS_URL em .env.local.example
  - Não toca lib/env.ts (responsabilidade do PR #122)"
  ```

- [ ] **Push + PR**

  Run:
  ```bash
  git push -u origin chore/wave-0-housekeeping
  gh pr create --title "chore(wave-0): housekeeping (redis + handoff + env)" --body "Wave 0 do plano de finalização (Closes nenhuma — meta-trabalho).

  - docker/redis/ para BullMQ (#122) e presença (#123)
  - HANDOFF.md atualizado para Phase 6/7
  - REDIS_URL em .env.local.example

  Spec: docs/superpowers/specs/2026-05-12-finalize-all-open-issues-design.md"
  ```

- [ ] **Aguardar CI verde e mergear**

  Run:
  ```bash
  gh pr checks --watch
  gh pr merge --squash --delete-branch
  git checkout main && git pull --ff-only
  ```

### Wave 0 — Go criteria

- [ ] `main` limpa, CI verde
- [ ] `redis-cli -p 6380 ping` → `PONG`
- [ ] Bucket `tradein-photos` existe e tem policies adequadas
- [ ] HANDOFF.md reflete Phase 6/7
- [ ] PRs Dependabot mergeados (`gh pr list --author "app/dependabot"` vazio)

---

## Task 1 — Wave 1: Bugs CRITICAL + HIGH (4 subagents paralelos)

**Goal:** Mergear 4 PRs fixando bugs CRITICAL/HIGH do multi-agent review #128.

**Dispatch model:** 4 subagents `generalPurpose` em paralelo, cada um responsável por 1 issue.

### Step 1.1: Dispatch #129 (CRITICAL — dedupe leadIds + auth)

- [ ] **Lançar subagent para #129**

  Prompt template:
  ```
  You are fixing GitHub issue #129 in repo gasparellodev/gasp-search.

  CONTEXT:
  - Branch from main: `fix/129-dedupe-leadids-auth`
  - Read CLAUDE.md (root), CONTRIBUTING.md, lib/CLAUDE.md, app/api/CLAUDE.md before coding.
  - Read full issue body: `gh issue view 129`

  TASK:
  Apply the exact fix described in issue body, with TDD:

  1. Write failing test in tests/unit/app/api/campaigns/route.test.ts:
     - Case "POST /api/campaigns with duplicate leadIds is accepted after dedup"
     - Mock supabase to return 1 row when called with deduped ids
  2. Run test, confirm fails.
  3. Edit app/api/campaigns/route.ts:77-86:
     - Replace `validLeads.length !== parsed.data.leadIds.length` check with deduped Set logic
     - Add .eq('user_id', user.id) to .in('id', ids) query
  4. Run test, confirm passes.
  5. Run full test suite + lint + tsc.
  6. Commit, push, open PR with `Closes #129`.
  7. Run `sentry-skills:code-review` skill on the PR, address findings as comments.
  8. Run `sentry-skills:security-review` skill, address findings.

  QUALITY GATES (non-negotiable):
  - npm run lint zero warnings
  - npx tsc --noEmit zero errors
  - Coverage maintained ≥80% lines, ≥75% branches
  - All 5 CI checks green
  - Both review skills run and documented

  Output: PR URL + summary.
  ```

  Invocar via `Task` tool com `subagent_type: generalPurpose`, `run_in_background: true`.

### Step 1.2: Dispatch #130 (HIGH security — webhook auth + slug nanoid)

- [ ] **Lançar subagent para #130**

  Prompt template:
  ```
  You are fixing GitHub issue #130 (HIGH severity, SECURITY) in repo gasparellodev/gasp-search.

  CONTEXT:
  - Branch from main: `fix/130-webhook-auth-hardening`
  - Read CLAUDE.md, CONTRIBUTING.md, app/api/whatsapp/webhook/CLAUDE.md, lib/evolution/CLAUDE.md, supabase/migrations/CLAUDE.md
  - Read full issue body: `gh issue view 130`

  TASK (3 fixes combinados, com TDD):

  1. Migration nova `supabase/migrations/0XXX_evolution_instance_nanoid_slug.sql`:
     - Adiciona coluna `evo_instance_v2` text (nullable inicialmente)
     - Backfill: para cada row em evolution_instances, generate nanoid(16) → evo_instance_v2
     - After backfill, NOT NULL + UNIQUE constraint em evo_instance_v2
     - Manter evo_instance antigo durante 1 deploy (comentário "deprecated, drop after Evolution restart")
     - Apply via Supabase MCP `apply_migration`

  2. lib/evolution/webhook.ts:
     - Substituir `evo_instance = user_${userId.slice(0,8)}` por nanoid(16) na criação de instância
     - Resolver `userId` via `lookupUserByInstance` ANTES de chamar `handleEvent` em TODOS os tipos (incluindo `unknown`)
     - Não permitir short-circuit antes da auth

  3. app/api/whatsapp/webhook/route.ts:
     - Adicionar `.eq('user_id', ctx.userId)` em TODOS os updates (linhas 99-105 incluindo `message.status`)
     - Cobrir todos os eventos lifecycle

  TDD: testes para cada um dos 3 cenários antes da implementação:
  - tests/unit/app/api/whatsapp/webhook/auth.test.ts
  - tests/unit/lib/evolution/webhook.test.ts (slug + lookup order)
  - tests/integration/webhook-tenant-isolation.test.ts (cross-tenant attempt rejected)

  QUALITY GATES + sentry-skills:security-review aprovado (findings críticos/HIGH endereçados).

  Output: PR URL + migration SQL aplicada confirmada.
  ```

### Step 1.3: Dispatch #131 (HIGH — terminal status real)

- [ ] **Lançar subagent para #131**

  Prompt template:
  ```
  You are fixing GitHub issue #131 in repo gasparellodev/gasp-search.

  CONTEXT:
  - Branch: `fix/131-terminal-status-real`
  - Read full issue body: `gh issue view 131`
  - lib/campaigns/processor.ts:179 tem ternário dead-code (`failed === 0 ? 'completed' : 'completed'`)

  TASK:
  1. tests/unit/lib/campaigns/processor.test.ts: caso "campanha com 100% falha termina como 'completed' (sentinela)"
  2. Run test, confirm fails.
  3. lib/campaigns/processor.ts:179: simplificar para `status: 'completed'` (decisão Opção 1 do body: UI já mostra failed_count separadamente).
  4. Run test, confirm passes.
  5. Run full suite + lint + tsc.
  6. PR + sentry-skills:code-review.

  Output: PR URL.
  ```

### Step 1.4: Dispatch #132 (HIGH — rate-limit AI)

- [ ] **Lançar subagent para #132**

  Prompt template:
  ```
  You are fixing GitHub issue #132 in repo gasparellodev/gasp-search.

  CONTEXT:
  - Branch: `fix/132-rate-limit-ai-ttl`
  - Read full issue body: `gh issue view 132`
  - app/api/ai/generate-message/route.ts:42-50 tem Map sem TTL (vaza memória) e bypass em multi-instance.

  TASK (TDD):
  1. Test: caso "Map entries are purged after RATE_LIMIT_MS * 10"
  2. Test: caso "two concurrent calls from same user → second gets 429 with Retry-After"
  3. Implementar: usar `Map<string, { ts: number; expiresAt: number }>`; periodic cleanup ou cleanup on-access (entries com ts < now - RATE_LIMIT_MS*10 são deletadas).
  4. Adicionar `Retry-After: 1` header em 429.
  5. (Opcional V1) Não migrar para Postgres counters — fica para V2 documentado em comment.
  6. PR + code-review.

  Output: PR URL.
  ```

### Step 1.5: Wait + validate Wave 1

- [ ] **Aguardar 4 PRs mergeados**

  Run periodicamente:
  ```bash
  gh pr list --state open --search "is:pr fix/129 OR fix/130 OR fix/131 OR fix/132"
  gh issue list --state open | grep -E "#(129|130|131|132)"
  ```

  Expected: 0 PRs abertos, 0 issues abertas dos 4 IDs.

- [ ] **Smoke E2E em main após cada merge**

  Run:
  ```bash
  git checkout main && git pull --ff-only
  npm run lint && npx tsc --noEmit && npm test && npm run test:e2e
  ```

  Expected: tudo verde. Se quebrar, abrir issue de regressão e fixar antes de prosseguir.

### Wave 1 — Go criteria

- [ ] 4 issues fechadas (#129, #130, #131, #132)
- [ ] CI verde em `main`
- [ ] `sentry-skills:security-review` rodado em #130 com findings críticos/HIGH endereçados
- [ ] Migration #130 aplicada e Evolution instances funcionando

---

## Task 2 — Wave 2: Bugs MEDIUM + tech-debt + STAGE refactor (7 subagents paralelos)

**Goal:** Mergear 7 PRs de fixes MEDIUM e tech-debt rollup do #138.

**Dispatch model:** 7 subagents `generalPurpose` em paralelo.

### Step 2.1: Dispatch #133 (cascade delete lead_messages)

- [ ] **Subagent para #133**

  Prompt:
  ```
  Fix issue #133 in gasparellodev/gasp-search.

  Branch: `fix/133-cascade-delete-lead-messages`
  Read issue body via `gh issue view 133`.

  TDD:
  1. tests/unit/lib/messages/list-conversations.test.ts: caso "thread de lead removido não aparece em listConversations" (após cascade).
  2. Migration `supabase/migrations/0XXX_lead_messages_cascade.sql`:
     ALTER TABLE lead_messages
     DROP CONSTRAINT lead_messages_lead_id_fkey,
     ADD CONSTRAINT lead_messages_lead_id_fkey
       FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
     Apply via Supabase MCP.
  3. lib/messages/list-conversations.ts:80-94: remover `.filter(x => x !== null)` (não mais necessário com cascade).
  4. app/api/whatsapp/webhook/route.ts:113-118: ao dropar inbound sem match, log estruturado `console.warn('inbound_dropped', { remoteJid, instance })`.
  5. PR + reviews.
  ```

### Step 2.2: Dispatch #134 (rate-limit campaigns)

- [ ] **Subagent para #134**

  Prompt:
  ```
  Fix issue #134.
  Branch: `fix/134-rate-limit-campaigns`
  TDD:
  1. tests/unit/app/api/campaigns/route.test.ts: caso "segunda campanha enquanto outra running → 409"
  2. tests/unit/app/api/campaigns/route.test.ts: caso "N campanhas/hora excedido → 429"
  3. app/api/campaigns/route.ts: antes do INSERT, verificar:
     - SELECT count(*) FROM campaigns WHERE user_id = ? AND status = 'running' → if >0 return 409
     - SELECT count(*) FROM campaigns WHERE user_id = ? AND created_at > now() - interval '1 hour' → if >= MAX_CAMPAIGNS_PER_HOUR (default 5) return 429
  4. lib/env.ts: adicionar `MAX_CAMPAIGNS_PER_HOUR` opcional default 5 (não NEXT_PUBLIC).
  5. PR + reviews.
  ```

### Step 2.3: Dispatch #135 (STAGE extract)

- [ ] **Subagent para #135**

  Prompt:
  ```
  Fix issue #135.
  Branch: `refactor/135-stage-presentation`
  TDD:
  1. tests/unit/lib/leads/stage-presentation.test.ts: snapshot dos exports STAGE_LABEL / STAGE_VARIANT / STAGE_ACCENT.
  2. lib/leads/stage-presentation.ts (novo):
     - export const STAGE_LABEL: Record<LeadStage, string>
     - export const STAGE_VARIANT: Record<LeadStage, BadgeVariant>
     - export const STAGE_ACCENT: Record<LeadStage, string> (Tailwind classes)
  3. Importar nos 5 arquivos:
     - components/pipeline/board.tsx (remover linha 41)
     - components/leads/leads-table.tsx (remover linha 57)
     - components/leads/lead-detail-drawer.tsx (remover linha 55)
     - components/dashboard/dashboard-view.tsx (remover linha 29)
     - components/leads/filters-bar.tsx (remover linha 34)
  4. app/(app)/leads/[id]/page.tsx:69: trocar `<Badge>{lead.stage}</Badge>` por `<Badge variant={STAGE_VARIANT[lead.stage]}>{STAGE_LABEL[lead.stage]}</Badge>`.
  5. Tests RTL existentes não devem quebrar (mesma label renderizada).
  6. PR + reviews.
  ```

### Step 2.4: Dispatch #138a (phone normalize + dark mode + magic nums)

- [ ] **Subagent para #138a**

  Prompt:
  ```
  Fix sub-PR #138a (parte de issue #138, agrupamento "phone + dark + magic nums").
  Branch: `chore/138a-phone-dark-magic`
  TDD:
  1. tests/unit/lib/evolution/phone.test.ts: normalizePhone covers 8-15 dígitos, strip non-numeric, with/sem código país.
  2. lib/evolution/phone.ts (novo): export function normalizePhone(input: string): string.
  3. lib/evolution/send.ts:46: substituir normalize inline por import normalizePhone.
  4. lib/evolution/webhook.ts:63: substituir normalize inline por import normalizePhone.
  5. components/whatsapp/instance-card.tsx:269: wrap QR em `<div className="bg-card p-4 rounded-lg">` (substituir bg-white literal).
  6. components/messages/conversation-thread.tsx:33: trocar `text-blue-500` por `text-sky-500 dark:text-sky-400`.
  7. lib/evolution/rate-limit.ts:16: export EVOLUTION_DEFAULT_THROTTLE_MS = 3_000.
  8. lib/campaigns/processor.ts:29: importar EVOLUTION_DEFAULT_THROTTLE_MS, substituir magic 3_000.
  9. lib/evolution/templates.ts:81: remover export de extractPlaceholders (manter função private).
  10. PR (squash de 1 commit) + reviews.

  Body do PR menciona "parte 1/4 do split do tech-debt #138 (sub-issue #138a)". NÃO usa `Closes #138` (deixa para o último sub-PR).
  ```

### Step 2.5: Dispatch #138b (redirectTo + duplicate detection)

- [ ] **Subagent para #138b**

  Prompt:
  ```
  Fix sub-PR #138b (parte 2/4).
  Branch: `chore/138b-redirect-duplicate`
  TDD:
  1. tests/unit/app/(auth)/callback/route.test.ts: caso "redirectTo=//evil.com → fallback /dashboard"
  2. tests/unit/app/(auth)/callback/route.test.ts: caso "redirectTo=/leads → preservado"
  3. app/(auth)/callback/route.ts:21: substituir guard atual por:
     ```ts
     const isValid = redirectTo.startsWith('/') && !redirectTo.startsWith('//');
     if (!isValid) redirectTo = '/dashboard';
     ```
  4. tests/unit/app/api/whatsapp/webhook/route.test.ts: caso "duplicate insert (PostgresError code 23505) returns 200 instead of throwing"
  5. app/api/whatsapp/webhook/route.ts:130-142: substituir `if (error.message.includes('duplicate'))` por `if ((error as { code?: string }).code === '23505')`.
  6. PR + reviews.
  ```

### Step 2.6: Dispatch #138c (regenerar types + remover casts)

- [ ] **Subagent para #138c**

  Prompt:
  ```
  Fix sub-PR #138c (parte 3/4) — REGEN TYPES.
  Branch: `chore/138c-regen-types`

  TASK:
  1. Antes de qualquer edit, rodar `npx tsc --noEmit` em main e salvar baseline de erros.
  2. Invocar Supabase MCP `generate_typescript_types` → grava em types/database.ts.
  3. Rodar `npx tsc --noEmit` — esperar erros novos onde antes tinha `as unknown as`.
  4. Remover os 12× `as unknown as` listados no body de #138:
     - lib/leads/*
     - lib/ai/messages.ts
     - lib/dashboard/summary.ts
     - lib/apify/enrich.ts
     - app/api/ai/generate-message/route.ts:103
  5. Onde regen não cobre (campos JSON tipados como `Json`), manter cast mas com type explícito (não `as unknown as`):
     ```ts
     // antes: const data = row.metadata as unknown as MyType;
     // depois: const data = row.metadata as MyType; // se MyType compatível com Json
     ```
  6. Tests pré-existentes devem continuar verdes (ou ajustes triviais).
  7. Coverage não pode cair.
  8. PR + reviews.

  Se algum cast não puder ser removido sem refactor grande, documentar no PR comment com justificativa.
  ```

### Step 2.7: Dispatch #138d (SSRF + dead branch)

- [ ] **Subagent para #138d (LAST sub-PR de #138)**

  Prompt:
  ```
  Fix sub-PR #138d (parte 4/4 — LAST). USA `Closes #138` no body.
  Branch: `chore/138d-ssrf-dead-branch`
  TDD:
  1. tests/unit/lib/validators/leads.test.ts: casos:
     - "website https://example.com → válido"
     - "website http://10.0.0.1 → rejeitado (private IP)"
     - "website http://localhost → rejeitado"
     - "website http://169.254.169.254 → rejeitado (AWS metadata)"
     - "website ftp://example.com → rejeitado (only http/s)"
  2. lib/validators/leads.ts: adicionar Zod refine em campo `website`:
     - Must start with `http://` or `https://`
     - Parse URL, reject if hostname matches:
       - localhost / 127.x.x.x / ::1
       - 10.x.x.x, 172.16-31.x.x, 192.168.x.x (RFC1918)
       - 169.254.x.x (link-local)
       - 100.64-127.x.x (CGNAT)
  3. lib/evolution/send.ts:120-128: remover branch `if (stage === 'contacted')` (dead — confirmar via grep que não há call site que precisa).
  4. PR body: `Closes #138` (encerra a issue mãe). Linkar os 3 sub-PRs anteriores (138a/b/c).
  5. Reviews.
  ```

### Step 2.8: Wait + validate Wave 2

- [ ] **Aguardar 7 PRs mergeados**

  Run periódico:
  ```bash
  gh issue list --state open --search "#133 OR #134 OR #135 OR #138"
  ```

  Expected: zero.

- [ ] **Smoke E2E após cada merge**

  Run:
  ```bash
  git checkout main && git pull --ff-only
  npm run lint && npx tsc --noEmit && npm test -- --coverage && npm run test:e2e
  ```

  Expected: tudo verde, coverage ≥80%/≥75%.

### Wave 2 — Go criteria

- [ ] 4 issues fechadas (#133, #134, #135, #138)
- [ ] Coverage mantido
- [ ] CI verde em main

---

## Task 3 — Wave 3: Lead UI convergência (2 subagents sequenciais)

**Goal:** Convergir `/leads/[id]` e drawer na mesma UI canônica + cross-links.

### Step 3.1: Dispatch #136 (drawer reutilizável)

- [ ] **Subagent para #136**

  Prompt:
  ```
  Fix issue #136 in gasparellodev/gasp-search.

  Branch: `feat/136-lead-tabs-unified`
  Read: gh issue view 136, components/leads/CLAUDE.md, app/(app)/leads/[id]/CLAUDE.md.

  TDD:
  1. tests/unit/components/leads/lead-tabs.test.tsx:
     - render mode="inline" → 4 tabs (Visão / Notas / Mensagens IA / Conversa)
     - render mode="standalone" → mesmas 4 tabs + standalone wrapper
     - edição inline (PATCH) funciona em ambos
     - validação Zod
  2. components/leads/lead-tabs.tsx (novo):
     - export type LeadTabsProps = { lead: Lead; mode: 'inline' | 'standalone'; onUpdate?: ... }
     - Tabs renderizam mesma estrutura
     - mode controla wrapper (Sheet vs full page)
  3. app/(app)/leads/[id]/page.tsx:
     - Substituir UI atual por <LeadTabs lead={lead} mode="standalone" />
     - Preservar SEO/metadata da page
  4. components/leads/lead-detail-drawer.tsx:
     - Substituir tabs internas por <LeadTabs lead={lead} mode="inline" />
     - Preservar Sheet wrapper
  5. E2E tests/e2e/leads-detail.spec.ts: editar campo em /leads/[id] e em drawer devem ter mesmo comportamento.
  6. Coverage ≥80% no novo componente.
  7. PR + reviews.
  ```

### Step 3.2: Dispatch #137 (cross-links) — APÓS #136 mergeado

- [ ] **Aguardar #136 mergeado e em main**

  Run:
  ```bash
  git checkout main && git pull --ff-only
  gh issue view 136 --json state
  # esperado: state: CLOSED
  ```

- [ ] **Subagent para #137**

  Prompt:
  ```
  Fix issue #137 (depende de #136 já mergeado).

  Branch: `feat/137-cross-links`
  Read: gh issue view 137.

  TDD:
  1. tests/unit/app/(app)/messages/[leadId]/page.test.tsx: header tem Link para /leads/[id] + Badge de stage.
  2. tests/unit/components/campaigns/target-status-table.test.tsx: nomes de leads são <Link>.
  3. tests/unit/components/pipeline/board.test.tsx: click em card abre LeadDetailDrawer (mesmo do #136).

  IMPLEMENTAÇÕES:
  1. app/(app)/messages/[leadId]/page.tsx: substituir `<h1>{lead.name}</h1>` por:
     ```tsx
     <Link href={`/leads/${lead.id}`} className="hover:underline">
       <h1>{lead.name}</h1>
     </Link>
     <Badge variant={STAGE_VARIANT[lead.stage]}>{STAGE_LABEL[lead.stage]}</Badge>
     ```
  2. components/campaigns/target-status-table.tsx:88: wrappar nome em `<Link href={`/leads/${t.lead_id}`}>`.
  3. components/pipeline/board.tsx (~258): card draggable agora também clicável → abre LeadDetailDrawer com o lead (reutilizar drawer do #136).
  4. Quando `NEXT_PUBLIC_WHATSAPP_ENABLED='1'` E lead tem phone: ícone secundário no header de /leads/[id] e drawer → href `/messages/${leadId}`.
  5. PR + reviews.
  ```

### Step 3.3: Wait + validate Wave 3

- [ ] **Aguardar #136 e #137 fechados**

  Run:
  ```bash
  gh issue list --state open | grep -E "#(136|137)"
  ```

  Expected: vazio.

- [ ] **E2E completo**

  Run:
  ```bash
  git checkout main && git pull --ff-only
  npm run test:e2e -- --grep "leads|pipeline|messages"
  ```

  Expected: verde.

### Wave 3 — Go criteria

- [ ] #136 e #137 fechadas
- [ ] E2E navegação leads ↔ messages ↔ campaigns ↔ pipeline passa
- [ ] CI verde

---

## Task 4 — Wave 4: Phase 6 features (3 subagents, parcialmente paralelo)

**Goal:** Dashboard insights + BullMQ + real-time indicators.

```
#124 (paralelo)
#122 (sequencial 1) → #123 (sequencial 2)
```

### Step 4.1: Dispatch #124 (dashboard insights) — paralelo

- [ ] **Subagent para #124**

  Prompt:
  ```
  Fix issue #124. Branch: `feat/124-dashboard-insights`.
  Read: gh issue view 124, lib/dashboard/CLAUDE.md.

  TDD:
  1. tests/unit/lib/dashboard/insights.test.ts:
     - getSourceBreakdown: agrupa por source, retorna { source, total, closedWon, conversionRate }
     - getFunnelStats: retorna 5 stages com count + dropRate entre etapas
  2. lib/dashboard/insights.ts (novo): both functions, server-only, recebem supabase client.
  3. components/dashboard/source-breakdown.tsx (novo): barras horizontais + Recharts/primitivos shadcn.
  4. components/dashboard/funnel.tsx (novo): bar chart 5 estágios.
  5. app/(app)/dashboard/page.tsx: integrar ambos os componentes.
  6. Skeleton + empty state em ambos.
  7. Dark mode consistente.
  8. Coverage ≥80% no lib novo.
  9. PR + reviews.
  ```

### Step 4.2: Dispatch #122 (BullMQ + Redis) — sequencial 1

- [ ] **Subagent para #122**

  Prompt:
  ```
  Fix issue #122 — feature grande. Branch: `feat/122-bullmq-redis`.
  Read: gh issue view 122, lib/campaigns/CLAUDE.md, docker/redis/README.md (já existente da Wave 0).

  TDD:
  1. tests/unit/lib/queue/redis.test.ts: singleton ioredis client.
  2. tests/unit/lib/queue/campaigns.test.ts: enqueue + dequeue de CampaignTargetJob.
  3. tests/unit/lib/queue/worker.test.ts: processa job → chama send → atualiza campaign_targets.status → atualiza campaigns counters.
  4. tests/integration/campaigns-queue.test.ts: small e2e com mock Evolution → counters via Realtime.

  IMPLEMENTAÇÕES:
  1. lib/env.ts: adicionar REDIS_URL (server-only, obrigatório).
  2. lib/queue/redis.ts: singleton ioredis com `new Redis(env.REDIS_URL)`.
  3. lib/queue/campaigns.ts: `new Queue<CampaignTargetJob>('campaign-targets', { connection })`.
  4. lib/queue/worker.ts: `new Worker('campaign-targets', processFn, { concurrency: 1 })`. processFn extraído de processor.ts.
  5. Refactor lib/campaigns/processor.ts:
     - Extrair função pura `processCampaignTarget(target)` (1 target).
     - Função `enqueueCampaign(campaign)` → enfileira N jobs.
     - Remover loop inline.
  6. app/api/campaigns/route.ts:
     - Mudar processCampaign(...) por enqueueCampaign(...).
     - Resposta vira `201 { campaignId, queuedTargets }` imediato.
  7. package.json: adicionar `"worker:campaigns": "tsx lib/queue/worker.ts"`.
  8. lib/queue/CLAUDE.md (novo): documenta arquitetura V1 dev / V2 prod (out-of-scope).
  9. docker/redis/README.md: já existe da Wave 0, validar conteúdo.
  10. PR body: ADR sobre V1 dev / V2 prod registrado.

  QUALITY GATES:
  - npm test passa com Redis local rodando (CI precisa de Redis service ou mock).
  - Considerar adicionar service Redis em .github/workflows/ci.yml para integration test.
  - Coverage ≥80% em lib/queue/.
  - PR + reviews (especial: security-review checa Redis sem auth = não vaza pra rede externa).
  ```

### Step 4.3: Dispatch #123 (real-time indicators) — APÓS #122 mergeado

- [ ] **Aguardar #122 fechada**

  Run:
  ```bash
  gh issue view 122 --json state
  ```

- [ ] **Subagent para #123**

  Prompt:
  ```
  Fix issue #123 (depende de #122). Branch: `feat/123-realtime-indicators`.
  Read: gh issue view 123.

  TDD:
  1. tests/unit/lib/evolution/webhook.test.ts: parser reconhece presence.update (composing/paused/available/unavailable).
  2. tests/unit/app/api/whatsapp/presence/[leadId]/route.test.ts: GET lê Redis TTL 60s.
  3. tests/unit/components/messages/conversation-thread.test.tsx: subscribe presence channel → re-render quando muda.

  IMPLEMENTAÇÕES:
  1. lib/evolution/webhook.ts: estender parser para presence.update events.
  2. lib/queue/redis.ts: já existe (#122). Usar.
  3. lib/whatsapp/presence.ts (novo): get/set presence em Redis com TTL 60s.
  4. app/api/whatsapp/presence/[leadId]/route.ts (novo): GET → { presence, lastSeen }.
  5. app/api/whatsapp/typing/route.ts (novo): POST do MessageComposer com debounce 2s; persiste em Redis (chave própria) + broadcast via Realtime channel.
  6. components/messages/conversation-thread.tsx: subscribe Supabase Realtime channel "presence-${leadId}".
  7. components/messages/message-composer.tsx: emite POST /typing com debounce 2s (lodash.debounce ou similar).
  8. components/messages/status-icon.tsx: animar transição sent → delivered → read quando lead_messages.status muda via Realtime sub.
  9. PR + reviews.
  ```

### Step 4.4: Wait + validate Wave 4

- [ ] **3 issues fechadas**

  Run:
  ```bash
  gh issue list --state open | grep -E "#(122|123|124)"
  ```

  Expected: vazio.

- [ ] **Validação manual worker**

  Run:
  ```bash
  docker compose -f docker/redis/docker-compose.yml ps
  npm run worker:campaigns &
  # criar campanha pequena via UI e ver counters atualizando
  ```

### Wave 4 — Go criteria

- [ ] 3 issues fechadas
- [ ] Worker rodando localmente
- [ ] E2E campanha pequena com counters via Realtime passa
- [ ] CI verde

---

## Task 5 — Wave 5: Phase 7 (6 subagents, dual-track)

**Goal:** Fechar 6 issues Phase 7 — institucionais em paralelo + Detail trio sequencial.

**Workflow multi-papel obrigatório** (subagents existentes em `.claude/agents/`):
1. `site-po`: refina AC, registra decisões abertas como comment no issue.
2. `site-dev`: implementa com TDD, abre PR no formato Sentry.
3. `site-qa`: valida funcional + edge cases + visual diff vs Figma; posta QA report como comment.
4. `site-reviewer`: roda code-review + security-review com checklist (service_role, RLS, XSS, rate-limit, PII).

**Cada issue Phase 7 segue o ciclo: PO → Dev → QA → Reviewer → Merge.**

### Step 5.1: PO refine de todas as 6 issues (paralelo, antes de qualquer dev)

- [ ] **Dispatch 6 subagents `site-po` em paralelo**

  Para cada issue (#226, #227, #228, #229, #230, #231):

  Prompt template:
  ```
  Refine AC of issue #N for Phase 7 implementation.

  Tasks:
  1. Read full issue body via `gh issue view N`.
  2. Verify all open questions in body are resolved or have explicit V1 decision.
  3. Verify dependencies listed exist in main (`grep -r <dep> components/`).
  4. Verify Figma URL is live (curl 200).
  5. Post comment on issue with:
     - "PO refinement complete"
     - List of decisions taken
     - Any V2 backlog items split out
     - GREEN/RED light for site-dev to start

  Output: comment URL + green/red.
  ```

### Step 5.2: Dispatch Sub-track A (institucionais, 3 paralelos)

- [ ] **#229 Sobre O1** — site-dev → site-qa → site-reviewer

  Prompt template para site-dev:
  ```
  Implement issue #229. Read PO comment first (last comment in issue).
  Branch: `feat/229-sobre-redesign-o1`.
  AC e Files listados no body do issue.
  Reuso obrigatório: home-google-reviews-embed e home-contact-form-quick (já mergeados em #257).
  Quality gates Phase 7: TDD + lint + tsc + coverage ≥80% + axe-core zero violations + visual diff Figma ≤5%.
  Após implementação, abre PR, então o orchestrator dispara site-qa.
  ```

- [ ] **#230 Contato O2** — site-dev → site-qa → site-reviewer

  Prompt template para site-dev:
  ```
  Implement issue #230. Read PO comment.
  Branch: `feat/230-contato-redesign-o2`.

  Atenção especial:
  - lib/env.ts: adicionar GOOGLE_MAPS_STATIC_API_KEY (opcional via Zod .optional()).
  - lib/sites/static-map.ts: buildStaticMapUrl({lat, lng, placeId, size}). Se env ausente, retorna null.
  - components/sites/contact/ContactDualPane.tsx: se buildStaticMapUrl retorna null OU lat/lng ausentes → fallback placeholder + link `https://google.com/maps/place/?q={endereço}`.
  - tests: cobrir fallback gracioso quando env ausente.
  - Reuso: home-contact-form-quick (#H3).

  Documentar em PR body que GOOGLE_MAPS_STATIC_API_KEY é opcional V1 (fallback funcional).
  ```

- [ ] **#231 Anunciar O3** — site-dev → site-qa → site-reviewer

  Prompt template para site-dev:
  ```
  Implement issue #231. Read PO comment.
  Branch: `feat/231-anunciar-redesign-o3`.

  Pre-condição: bucket `tradein-photos` validado na Wave 0.

  Atenção especial:
  - 4-step stepper com photo upload via presigned URLs (Server Action), não direto cliente → bucket.
  - browser-image-compression antes do upload (max width 1920px).
  - Path: `tradein-photos/${lead_id}/${index}-${timestamp}.${ext}`
  - LGPD: aviso "Borre placa antes de enviar" antes do upload step.
  - LGPD audit: salvar `consent_text + ip + user_agent + timestamp` no momento do submit.
  - Rate limit: 3 submits/hour/IP (in-memory ok V1).
  - Honeypot field + HMAC/origin check em Server Action.
  - URL param `car_target_slug=` (de D3 — pode chegar antes de D3 mergear).

  Coverage ≥80% em lib/sites/upload-tradein-photos.ts e announce.schema.ts.
  ```

### Step 5.3: Dispatch Sub-track B (Detail trio sequencial)

- [ ] **#226 Detail D1** — site-dev primeiro

  Prompt:
  ```
  Implement issue #226 (D1). Branch: `feat/226-detail-d1`.

  Atenção especial:
  - DetailGalleryCinema: scroll-snap CSS + JS mínimo (decisão dev: usar scroll-snap, não embla, para lighter bundle). Justificar no PR.
  - Lightbox Radix Dialog: keyboard nav ←→ + ESC + Home/End + focus return on close.
  - <Image priority> primeira foto (LCP) + sizes attr.
  - Alt text: `${car.brand} ${car.model} ${car.year} - foto ${index+1}`.
  - axe-core zero violations critical/serious.

  Reuso: <Breadcrumb> shared (se #P1 já extraiu; senão usar inline com TODO de refactor).
  ```

- [ ] **#227 Detail D2** — APÓS #226 mergeado

  Aguardar:
  ```bash
  gh issue view 226 --json state
  # esperado: CLOSED
  ```

  Prompt:
  ```
  Implement issue #227 (D2). Branch: `feat/227-detail-d2`.

  Atenção:
  - DetailFinancingCalcInline EXPANDED por default (lever conversion).
  - <DISCLAIMER> CDC/Bacen obrigatório.
  - Stock disponibilidade: car.available === false → badge "VENDIDO" + CTAs disabled.
  - Price negotiation: price === null → "Preço sob consulta".
  - WhatsApp template "vehicle" (de F3 já mergeado) com car context.
  - Wireup FloatingInstallmentBar (G3) com useCarContext(slug, carSlug).
  - padding-bottom: 80px no <main> mobile detail.
  - Z-index: sticky price-block < installment-bar.
  ```

- [ ] **#228 Detail D3** — APÓS #226 e #227 mergeados

  Aguardar:
  ```bash
  gh issue view 227 --json state
  # esperado: CLOSED
  ```

  Prompt:
  ```
  Implement issue #228 (D3). Branch: `feat/228-detail-d3`.

  Atenção especial:
  - lib/sites/find-similar-cars.ts: ordem (1) mesma categoria/brand, (2) faixa preço ±20%, (3) ordenado por proximidade preço. Coverage ≥95% (8+ casos).
  - Fallback se < 4 similar: top-priced cars com badge "Você também pode gostar".
  - Empty state se estoque < 4: 1-3 cards + CTA "Ver estoque completo".
  - tradein widget: link para `/anunciar?car_target_slug=${currentCarSlug}` (deve funcionar mesmo se #231 ainda não merged — graceful fallback).
  - lib/sites/detail-faq-templates.ts: substituições {model}/{year}/{brand}.
  - <SiteFAQ> shared se #P1 extraído; senão inline.
  ```

### Step 5.4: QA + Review em CADA PR Phase 7

- [ ] **Após cada site-dev fechar PR (não merge ainda), dispatch site-qa**

  Prompt site-qa:
  ```
  QA validate PR #N for issue #M.

  Tasks:
  1. Checkout branch, run npm test + npm run test:e2e + npm run lint.
  2. Edge case testing per AC list.
  3. If UI changes: visual diff vs Figma (anexar prints ao PR comment).
  4. axe-core scan: zero critical/serious violations.
  5. Mobile viewport (375px) check.
  6. Post comment "QA report" with pass/fail per AC.

  Output: ✓ pass / ✗ fail with reasoning.
  ```

- [ ] **Se QA pass, dispatch site-reviewer**

  Prompt site-reviewer:
  ```
  Final review PR #N for issue #M.

  Tasks:
  1. Run sentry-skills:code-review skill.
  2. Run sentry-skills:security-review skill with checklist:
     - service_role used only server-side
     - RLS policies covered
     - XSS in dynamic content (especially user-generated like #231 photos)
     - Rate-limit (#231 announce form)
     - PII handling (#231 LGPD audit)
  3. Post comments with findings.
  4. If approved: comment "✓ Approved for merge".
  5. If blocked: comment "✗ Blocked: <reason>" — site-dev re-iterates.

  Output: approve/block + findings count.
  ```

- [ ] **Após site-reviewer aprovar, eu (orchestrator) mergeio**

  Run:
  ```bash
  gh pr merge <N> --squash --delete-branch
  ```

### Step 5.5: Wait + validate Wave 5

- [ ] **6 issues fechadas**

  Run:
  ```bash
  gh issue list --state open --milestone "Phase 7 — Site Generator (Concessionárias)" | grep -E "#(226|227|228|229|230|231)"
  ```

  Expected: vazio.

- [ ] **Smoke E2E completo Phase 7**

  Run:
  ```bash
  git checkout main && git pull --ff-only
  npm run test:e2e -- tests/e2e/sites/
  ```

  Expected: tudo verde.

### Wave 5 — Go criteria

- [ ] 6 issues Phase 7 fechadas
- [ ] axe-core zero violations critical/serious em todas as 6 rotas
- [ ] Visual diff Figma ≤ 5% em cada PR (documentado em comment)
- [ ] CI verde

---

## Task 6 — Wave 6: Phase 7 polish + visual baseline (2 subagents paralelos)

**Goal:** Analytics + visual baseline final.

### Step 6.1: Pre-condição

- [ ] **Validar hook #P3 LGPD disponível**

  Run:
  ```bash
  rg "useConsent" components/ lib/
  ```

  Expected: hook existe em algum file (do PR #263). Se ausente, parar e investigar.

### Step 6.2: Dispatch #233 (Analytics P2)

- [ ] **Subagent para #233**

  Prompt:
  ```
  Implement issue #233. Branch: `feat/233-analytics-p2`.
  Read: gh issue view 233.

  Atenção especial:
  - GA4 consent-gated CRÍTICO: <Script> só monta após useConsent('analytics') retorna true.
  - lib/env.ts: NEXT_PUBLIC_GA4_ID, NEXT_PUBLIC_GSC_VERIFICATION — ambos opcionais via Zod.
  - Sem GA4_ID → componente não monta, log warning dev.
  - Sem GSC_VERIFICATION → meta tag omitida.
  - @vercel/analytics: server-side, zero cookies, sem consent.
  - Events: whatsapp_click, form_submit, phone_click, tradein_submit, financing_calc, car_detail_view.
  - lib/analytics/track-event.ts: typed dispatcher.
  - docs/ANALYTICS.md.

  Tests:
  - opt-out → GA4 não monta
  - opt-in → GA4 monta + page_view dispara
  - GA4_ID ausente → no-op
  - events typed corretamente.
  ```

### Step 6.3: Dispatch #204 (Visual baseline v3)

- [ ] **Subagent para #204**

  Prompt:
  ```
  Implement issue #204. Branch: `test/204-visual-baseline-v3`.
  Read: gh issue view 204.

  Tasks:
  1. Gerar 12 baselines em tests/visual/figma-baseline/v3/:
     - home-desktop.png (1280×800), home-mobile.png (390×844)
     - estoque-desktop, estoque-mobile
     - detail-desktop, detail-mobile
     - sobre-desktop, sobre-mobile
     - contato-desktop, contato-mobile
     - anunciar-desktop, anunciar-mobile
  2. Usar fixture seeded de tests/fixtures/lead-site.ts.
  3. Spec tests/visual/sites-routes.spec.ts: renderiza site + snapshot vs baseline, threshold 0.1%.
  4. .github/workflows/ci.yml: adicionar step `npx playwright test tests/visual/sites-routes.spec.ts`.
  5. tests/visual/README.md: documenta re-baseline workflow.
  6. PR + reviews.
  ```

### Step 6.4: Wait + validate Wave 6 + plan completion

- [ ] **2 issues fechadas**

  Run:
  ```bash
  gh issue list --state open | grep -E "#(233|204)"
  ```

  Expected: vazio.

- [ ] **Validação final do plano completo**

  Run:
  ```bash
  # Métrica 1: zero issues abertas Phase 6/7
  P6=$(gh issue list --state open --milestone "Phase 6 — Local hardening & Insights" --json number | jq length)
  P7=$(gh issue list --state open --milestone "Phase 7 — Site Generator (Concessionárias)" --json number | jq length)
  echo "Phase 6 open: $P6, Phase 7 open: $P7"
  # esperado: ambos 0

  # Métrica 2: zero PRs Dependabot abertos
  gh pr list --author "app/dependabot" --json number | jq length
  # esperado: 0

  # Métrica 3: CI verde em main
  gh run list --branch main --limit 1 --json conclusion
  # esperado: success

  # Métrica 4: coverage
  npm test -- --coverage 2>&1 | grep -E "Lines|Branches"
  # esperado: ≥ 80% lines, ≥ 75% branches

  # Métrica 7: branches removidas
  git branch -r | wc -l
  # esperado: << 50 (era ~50 no início)

  # Métrica 8: Redis up
  docker compose -f docker/redis/docker-compose.yml ps
  # esperado: gasp-search-redis healthy
  ```

### Wave 6 / Plan — Final criteria

- [ ] 22 issues + 4 itens adjacentes fechados (28 PRs)
- [ ] 0 issues abertas em Phase 6 e Phase 7
- [ ] 0 PRs Dependabot abertos
- [ ] CI verde em main
- [ ] Coverage mantido
- [ ] HANDOFF.md atualizado (Wave 0)
- [ ] CLAUDE.md atualizado em pastas tocadas
- [ ] Branches obsoletas removidas
- [ ] Worker Redis rodando localmente
- [ ] code-review + security-review documentados em cada PR aplicável
- [ ] 12 baselines verdes em CI

---

## Self-review checklist (executar após este plano estiver pronto)

- [ ] **Spec coverage**: cada seção/requisito do spec tem task correspondente?
  - Wave 0 ✓ (Task 0)
  - Wave 1 ✓ (Task 1, 4 sub-steps)
  - Wave 2 ✓ (Task 2, 7 sub-steps incluindo #138 split)
  - Wave 3 ✓ (Task 3, 2 sub-steps)
  - Wave 4 ✓ (Task 4, 3 sub-steps)
  - Wave 5 ✓ (Task 5, 6 sub-steps + multi-papel)
  - Wave 6 ✓ (Task 6, 2 sub-steps + métricas finais)
  - Bloqueios externos ✓ (tratamento explícito em Wave 0 e prompts dos subagents)

- [ ] **Placeholder scan**: nenhum TBD/TODO/"implement later". Todos os prompts contêm:
  - Branch name exato
  - Issue body referência
  - TDD steps concretos
  - Files exatos (de cada issue body)
  - Quality gates explícitos

- [ ] **Type consistency**: nomes referenciados consistentes?
  - `LeadTabs` (Wave 3 #136) é o mesmo nome usado em Wave 3 #137
  - `STAGE_LABEL/STAGE_VARIANT/STAGE_ACCENT` consistentes em #135 e #137
  - `processCampaignTarget` / `enqueueCampaign` em #122
  - `normalizePhone` em #138a
  - `findSimilarCars` em #228
  - `buildStaticMapUrl` em #230

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-12-finalize-all-open-issues-plan.md`.**

Próximo passo: usar `superpowers:subagent-driven-development` para executar wave-a-wave. Dois modos sugeridos:

1. **Strict gating** (recomendado): execute Wave 0 inline, depois aguarde aprovação manual antes de cada wave subsequente. Permite ajuste de rota entre waves.

2. **Auto-flow**: execute todas as waves consecutivamente, com checkpoint visual entre cada PR via run reports. Mais rápido mas menos controle.

Qual modo você prefere?
