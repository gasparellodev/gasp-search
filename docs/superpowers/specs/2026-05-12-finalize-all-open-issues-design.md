# Finalização das 22 issues abertas — Plano de execução

| Campo | Valor |
|---|---|
| Status | **Approved for implementation** |
| Owner | Vinícius (GaspLab) |
| Escrito | 2026-05-12 |
| Brainstorm | Sessão `brainstorming` skill — 2026-05-12 |
| Skills | `subagent-driven-development`, `test-driven-development`, `using-superpowers` |
| Próximo passo | Invocar `writing-plans` skill para gerar plano executável wave-a-wave |

---

## 1. Resumo executivo

Fechar as **22 issues abertas** do repositório `gasparellodev/gasp-search` + 4 itens adjacentes (3 PRs Dependabot, limpeza de branches, atualização do HANDOFF.md, split do tech-debt #138 em 4 sub-PRs).

**Modelo de execução**: `subagent-driven-development` em **7 waves linearmente sequenciais**. Dentro de cada wave, N subagents abrem PRs em paralelo. Wave seguinte só inicia quando todos os PRs da wave anterior estão mergeados e `main` está com CI verde.

**Quality gates por PR** (não-negociáveis, definidos em `CLAUDE.md` e `CONTRIBUTING.md`):

1. TDD obrigatório (teste falhando antes da implementação).
2. `npm run lint` zero warnings.
3. `npx tsc --noEmit` zero errors.
4. `npm test` verde; coverage ≥ 80% lines/functions/statements, ≥ 75% branches em scope (`lib/`, `app/api/`, composições em `components/{layout,search,leads,pipeline,ai,sites}/`).
5. `npm run test:e2e` verde para fluxos afetados.
6. CI verde (5 status checks: lint, typecheck, unit, e2e, build).
7. `sentry-skills:code-review` rodado e endereçado.
8. `sentry-skills:security-review` rodado e endereçado (especial em #130 webhook).
9. `CLAUDE.md` atualizado em **toda pasta** que recebeu arquivo novo/modificado.
10. Squash merge com `Closes #N`.

---

## 2. Mapeamento das 22 issues + dependências

| # | Tema | Severidade | Wave | Depende de | Bloqueio externo |
|---|---|---|---|---|---|
| #129 | dedupe leadIds + auth | CRITICAL | 1 | — | — |
| #130 | webhook auth (slug + tenant) | HIGH (security) | 1 | — | migration nova |
| #131 | terminal status real | HIGH | 1 | — | — |
| #132 | rate-limit AI | HIGH | 1 | — | — |
| #133 | listConversations + cascade | MEDIUM | 2 | — | migration nova |
| #134 | rate-limit campaigns | MEDIUM | 2 | — | — |
| #135 | STAGE_LABEL extract | MEDIUM | 2 | — | — |
| #138a | normalizePhone + dark mode + magic nums | LOW | 2 | — | — |
| #138b | redirectTo guard + duplicate detection | LOW | 2 | — | — |
| #138c | regenerar types/database.ts + remover `as unknown as` | LOW | 2 | — | Supabase MCP |
| #138d | SSRF guard em leads.website + dead branch | LOW | 2 | — | — |
| #136 | convergir lead UI canônica | MEDIUM | 3 | — | — |
| #137 | cross-links leads/messages/campaigns/pipeline | MEDIUM | 3 | #136 | — |
| #124 | dashboard insights (funil + source) | feat | 4 | — | — |
| #122 | BullMQ + Redis (substitui processor) | feat | 4 | — | Redis Docker (Wave 0) |
| #123 | real-time indicators (typing/online/read) | feat | 4 | #122 | Redis compartilhado |
| #229 | Sobre redesign O1 | feat (Phase 7) | 5 | — | — |
| #230 | Contato O2 (dual-pane + Static Maps) | feat (Phase 7) | 5 | — | Google Maps (fallback gracioso) |
| #231 | Anunciar O3 (4-step + photo upload) | feat (Phase 7) | 5 | — | bucket Storage validado (Wave 0) |
| #226 | Detail D1 (gallery + breadcrumb + info + spec) | feat (Phase 7) | 5 | — | — |
| #227 | Detail D2 (price + financing + CTA) | feat (Phase 7) | 5 | #226 | — |
| #228 | Detail D3 (tradein + similar + faq) | feat (Phase 7) | 5 | #226, #227 | — |
| #233 | Analytics P2 (GA4 + Vercel + GSC) | chore (Phase 7) | 6 | — | GA4/GSC (fallback gracioso) |
| #204 | Visual baseline v3 (12 baselines) | test (Phase 7) | 6 | #226, #227, #228, #229, #230, #231 | — |

**Issues nas milestones de origem**:
- Phase 6 — Local hardening & Insights: 13 issues
- Phase 7 — Site Generator (Concessionárias): 8 issues
- Sem milestone (Phase 7 visual): 1 (#204)

**Total de PRs**: 24 PRs de issues (22 issues, com #138 dividido em 4 sub-PRs `a/b/c/d`) + 4 adjacentes (3 Dependabot + 1 housekeeping multi-commit) = **28 PRs**.

### 2.1 Tratamento de bloqueios externos

| Tipo | Tratamento |
|---|---|
| Redis Docker (#122, #123) | Eu subo `docker compose up -d` na **Wave 0**. Subagent da issue consome `REDIS_URL`. |
| Migration #130 (slug nanoid) | Subagent escreve migration + backfill SQL idempotente; subagent roda via Supabase MCP. |
| Migration #133 (cascade delete) | Subagent escreve `ALTER TABLE lead_messages ... ON DELETE CASCADE` + backfill se necessário. |
| Regenerar `types/database.ts` (#138c) | Subagent invoca Supabase MCP `generate_typescript_types`. |
| Bucket `tradein-photos` (#231) | Eu valido na **Wave 0** via Supabase MCP `list_buckets`. Crio com policies se ausente. |
| `GOOGLE_MAPS_STATIC_API_KEY` (#230) | Implementação com env opcional via Zod `.optional()`. Se ausente: placeholder visual + link `google.com/maps/place/?q=...`. Subagent inclui test do fallback. |
| `NEXT_PUBLIC_GA4_ID` (#233) | Env opcional. Se ausente: tag não monta, log warning em dev. Subagent inclui test do no-op. |
| `NEXT_PUBLIC_GSC_VERIFICATION` (#233) | Env opcional. Se ausente: meta tag omitida. Subagent inclui test. |

---

## 3. Estrutura das 7 waves

### Wave 0 — Housekeeping (eu, sem subagents, ~1h)

1. **Mergear PRs Dependabot** (#86, #87, #88):
   - `actions/setup-node` 4.4.0 → 6.4.0
   - `actions/checkout` 4.3.1 → 6.0.2
   - `actions/upload-artifact` 4.6.2 → 7.0.1
   - Para cada: verificar diff trivial, CI verde, `gh pr merge <N> --squash --delete-branch`.

2. **Limpar branches obsoletas** (locais e remotas):
   ```bash
   git fetch --all --prune
   for b in $(git branch -r --merged origin/main | grep -v 'origin/main\|HEAD' | sed 's|origin/||'); do
     git push origin --delete "$b"
   done
   git branch --merged main | grep -v '\*\|main' | xargs -n1 git branch -d
   ```

3. **Atualizar `HANDOFF.md`** para refletir Phase 6/7 (hoje fala de Phase 2/3/4). Linkar este spec.

4. **Subir Redis dedicado**:
   - Criar `docker/redis/docker-compose.yml` (Redis 7-alpine, porta `6380` para não conflitar com `gasp-evolution-redis`, volume nomeado `redis-data`, `--appendonly yes`).
   - Criar `docker/redis/README.md` com instruções.
   - `docker compose up -d` + `redis-cli -p 6380 ping` → `PONG`.
   - Adicionar `REDIS_URL=redis://localhost:6380` em `.env.local.example`. **Não** tocar `lib/env.ts` ainda (#122 faz com TDD).

5. **Validar bucket `tradein-photos`** via Supabase MCP `list_buckets`:
   - Se existir: validar policies via `list_policies` (signed URLs, **sem** public read; INSERT/SELECT restritos a `service_role`).
   - Se ausente: criar bucket + policies adequadas e documentar em `docs/superpowers/reports/`.

**Critério go/Wave 1**:
- `main` limpa, CI verde.
- `redis-cli -p 6380 ping` → `PONG`.
- Bucket existe.
- `HANDOFF.md` reflete estado atual.

---

### Wave 1 — Bugs CRITICAL + HIGH (4 PRs paralelos, ~4h)

| # | Tarefa | Severidade |
|---|---|---|
| #129 | Dedup leadIds + autorização robusta em `POST /api/campaigns` | CRITICAL |
| #130 | Webhook auth — slug nanoid + migration backfill + filtro `user_id` em todos updates | HIGH (security) |
| #131 | Terminal status real em `lib/campaigns/processor.ts:179` (remove ternário dead-code) | HIGH |
| #132 | Rate-limit AI — TTL Map (purge antiga) + `Retry-After: 1` | HIGH |

**Por que paralelo**: 4 áreas distintas (campaigns route, whatsapp/webhook, campaigns processor, ai route). Zero overlap em arquivos.

**Critério go/Wave 2**:
- 4 PRs mergeados.
- CI verde em `main`.
- `sentry-skills:security-review` rodado em #130 e findings críticos/high endereçados (documentados como comment no PR).

---

### Wave 2 — Bugs MEDIUM + tech-debt + STAGE refactor (7 PRs paralelos, ~3h)

| # | Tarefa |
|---|---|
| #133 | Cascade delete `lead_messages.lead_id` + log estruturado no webhook drop |
| #134 | Rate-limit campanhas — 409 se outra já running + limite N/h |
| #135 | Extrair `STAGE_LABEL/STAGE_VARIANT/STAGE_ACCENT` em `lib/leads/stage-presentation.ts` + corrigir `/leads/[id]` que mostra enum cru |
| #138a | `lib/evolution/phone.ts` (normalizePhone único) + `bg-card` no QR + `text-sky-*` dark variant + `EVOLUTION_DEFAULT_THROTTLE_MS` |
| #138b | `callback/route.ts` redirectTo guard (`//evil.com`) + duplicate detection via `code === '23505'` |
| #138c | Regenerar `types/database.ts` via Supabase MCP + remover 12× `as unknown as` em `lib/leads/*`, `lib/ai/messages.ts`, `lib/dashboard/summary.ts`, `lib/apify/enrich.ts`, `app/api/ai/generate-message/route.ts` |
| #138d | SSRF guard em `leads.website` (Zod refine + bloqueio hosts privados) + remover dead branch `stage === 'contacted'` em `lib/evolution/send.ts:120-128` |

**Por que paralelo**: cada sub-PR toca arquivo distinto. Coordenação: #138c (types regen) é o mais arriscado — pode quebrar consumidores fora do scope original. Mitigação: subagent roda `npx tsc --noEmit` no fim e ajusta consumidores no mesmo PR.

**Critério go/Wave 3**:
- 7 PRs mergeados.
- Coverage mantido (≥80% lines, ≥75% branches).

---

### Wave 3 — Lead UI convergência (2 PRs sequenciais, ~10h)

| # | Tarefa | Ordem |
|---|---|---|
| #136 | Criar `<LeadTabs mode="inline" \| "standalone">` reutilizável; integrar `/leads/[id]/page.tsx` (standalone) e `lead-detail-drawer.tsx` (inline); edição inline (PATCH) vive no componente unificado | 1º |
| #137 | Cross-links em `/messages/[leadId]`, `TargetStatusTable`, pipeline cards. Pipeline card click abre drawer reutilizável de #136 | 2º (depende de #136) |

**Critério go/Wave 4**:
- 2 PRs mergeados.
- E2E navegação leads ↔ messages ↔ campaigns ↔ pipeline passa.

---

### Wave 4 — Phase 6 features (3 PRs, paralelismo parcial, ~14h)

```
┌─ #124 dashboard insights ─────────────────────┐
│                                                │
└─ #122 BullMQ + Redis ──→ #123 real-time ──────┘
```

| # | Tarefa | Paralelismo |
|---|---|---|
| #124 | `getSourceBreakdown` + `getFunnelStats` em `lib/dashboard/insights.ts`; componentes `<SourceBreakdown />` e `<Funnel />` em `/dashboard`; Recharts | Paralelo (independente) |
| #122 | `docker/redis/` (já criado na Wave 0); `lib/queue/{redis,campaigns,worker}.ts`; refactor `processor.ts`; rota `POST /api/campaigns` enfileira; script `npm run worker:campaigns`; CLAUDE.md `lib/queue/` | Sequencial-1 |
| #123 | `presence.update` parser; Redis TTL 60s; `GET /api/whatsapp/presence/[leadId]`; subscribe Realtime in-memory; `POST /api/whatsapp/typing` com debounce 2s; `StatusIcon` animation | Sequencial-2 (depende de #122) |

**Decisão de arquitetura (registrar no PR de #122)**: V1 do worker roda via script Node standalone (`npm run worker:campaigns`) lançado pelo dev em terminal separado. V2 (produção): Vercel Cron / serviço dedicado fora-de-escopo deste plano.

**Critério go/Wave 5**:
- 3 PRs mergeados.
- Worker rodando localmente (`docker compose ps` saudável, script ativo).
- E2E campanha pequena (3 leads mock) verifica counters via Realtime.

---

### Wave 5 — Phase 7 (6 PRs, paralelismo dual-track, ~22h)

```
Sub-track A (institucionais — paralelo entre si):
  #229 Sobre O1
  #230 Contato O2
  #231 Anunciar O3

Sub-track B (Detail — sequencial estrito):
  #226 D1 ──→ #227 D2 ──→ #228 D3
```

**Workflow multi-papel Phase 7** (subagents existentes em `.claude/agents/`):
1. `site-po`: refina AC da issue, registra decisões abertas como comment.
2. `site-dev`: implementa com TDD, abre PR no formato Sentry.
3. `site-qa`: valida funcional + edge cases + visual diff vs Figma; posta QA report como comment.
4. `site-reviewer`: roda `sentry-skills:code-review` + `sentry-skills:security-review` com checklist (service_role, RLS, XSS, rate-limit, PII).

| # | Tarefa | Sub-track |
|---|---|---|
| #229 | Sobre redesign: `AboutHeroEditorial` + `AboutMissionVision` + `AboutWarrantyDeepdive` + reuso google-reviews-embed + contact-form-quick (já mergeados) | A |
| #230 | Contato: dual-pane + Static Maps server-side (com fallback) + `BusinessHours` + `WhatsAppDirectCard` + reuso PaymentStrip | A |
| #231 | Anunciar: hero + 4-step stepper + photo upload Supabase Storage (presigned URLs, max 8 fotos, client-side resize) + LGPD audit + rate-limit + honeypot | A |
| #226 | Detail D1: `DetailBreadcrumb` + `DetailGalleryCinema` (full-bleed 70dvh, scroll-snap, lightbox Radix Dialog) + `DetailInfoBlock` + `DetailSpecGrid` | B-1 |
| #227 | Detail D2: `DetailPriceBlock` sticky + `DetailFinancingCalcInline` (reuso `lib/finance.ts`) + `DetailTrustBadges` + `DetailCtaStack` + wireup `FloatingInstallmentBar` | B-2 (após #226) |
| #228 | Detail D3: `DetailTradeinWidget` (URL param `car_target_slug`) + `DetailSimilarVehicles` (`lib/sites/find-similar-cars.ts`) + `DetailFaqVehicle` (templates) | B-3 (após #226, #227) |

**Conflito potencial**: sub-track A toca rotas distintas (`/sobre`, `/contato`, `/anunciar`); sub-track B toca rota `/estoque/[carSlug]`. Conflitos esperados apenas em `app/sites/[slug]/layout.tsx` (resolução: rebase imediato após cada merge).

**Critério go/Wave 6**:
- 6 PRs mergeados.
- axe-core zero violations critical/serious em todas as 6 rotas.
- Visual diff vs Figma ≤ 5% em cada PR.

---

### Wave 6 — Phase 7 polish + visual baseline (2 PRs, ~4h)

| # | Tarefa | Paralelismo |
|---|---|---|
| #233 | `<GA4Tag>` consent-gated (depende de hook do #P3 LGPD já mergeado); `@vercel/analytics`; GSC meta tag; `track-event.ts`; events: `whatsapp_click`, `form_submit`, `phone_click`, `tradein_submit`, `financing_calc`, `car_detail_view`; `docs/ANALYTICS.md` | Paralelo |
| #204 | 12 baselines (6 rotas × 2 viewports) em `tests/visual/figma-baseline/v3/`; spec `tests/visual/sites-routes.spec.ts`; threshold 0.1%; CI step | Paralelo |

**Pré-condição verificada antes da Wave 6**: confirmar via `grep -r useConsent components/` que hook do #P3 LGPD existe e é importável.

**Critério final do plano**:
- 0 issues abertas em Phase 6 e Phase 7.
- 0 PRs Dependabot abertos.
- CI verde em `main` em todos os 5 checks.
- Coverage ≥ 80% lines / ≥ 75% branches em scope.
- HANDOFF.md atualizado.
- CLAUDE.md atualizado em pastas tocadas.
- Branches obsoletas removidas.
- Worker Redis rodando localmente (validação manual).
- 12 baselines verdes em CI.

---

## 4. Riscos e mitigações

> Legenda: **P** = Probabilidade, **I** = Impacto, **B** = Baixo, **M** = Médio, **A** = Alto.

| Risco | P | I | Mitigação |
|---|---|---|---|
| Migration #130 (slug nanoid) quebra webhook em prod (instâncias antigas) | M | A | Backfill que mantém slug antigo durante 1 deploy; coluna antiga marcada `deprecated`; comunicar restart das instâncias Evolution. |
| #138c (types regen) muda assinaturas e quebra compilação fora do scope | M | M | Subagent roda `npx tsc --noEmit` no fim do PR; corrige consumidores no mesmo PR; mantém `as unknown as` onde regen não cobre (campos JSON). |
| #122 BullMQ worker process: como executar em prod? | A | A | V1 dev: script standalone. V2 prod: out-of-scope, documenta em ADR no PR. |
| Wave 5 (6 PRs Phase 7) gera conflito em `app/sites/[slug]/layout.tsx` | M | M | Mergear D1 primeiro (rota distinta); institucionais tocam páginas distintas; rebase imediato pós-merge. |
| Coverage cai em Wave 2 (bug fixes pequenos = poucos testes novos) | B | M | TDD obrigatório: cada bug fix abre com test sentinela que reproduz o caso descrito no body da issue. |
| #204 visual baseline depende de Figma vivo | B | M | Antes da Wave 6, validar URLs Figma das 6 rotas com Vinícius. |
| Subagents paralelos em Wave 2 (7 PRs) sobrecarregam CI runners | B | B | GitHub Actions paraleliza por workflow; cada PR independente. |
| Regressão composta entre waves | M | M | Gate entre waves: smoke E2E completo (`npm run test:e2e`) em `main` antes de iniciar próxima wave. |
| GA4 consent (#233) — `#P3 LGPD` não está realmente disponível | B | B | Validar antes da Wave 6 via `grep -r useConsent`. |
| Bucket `tradein-photos` sem policies adequadas | B | A | Validar policies na Wave 0 via Supabase MCP `list_policies`; refinar se necessário. |

---

## 5. Cronograma estimado

| Wave | PRs | Esforço/PR | Paralelismo | Wall-clock |
|---|---|---|---|---|
| 0 | 4 commits | ~30min | sequencial (eu) | ~1h |
| 1 | 4 | 2-4h | 4× paralelo | ~4h |
| 2 | 7 | 1-3h | 7× paralelo | ~3h |
| 3 | 2 | 3-5h | sequencial | ~10h |
| 4 | 3 | 6-12h | parcial | ~14h |
| 5 | 6 | 4-8h | dual-track | ~22h |
| 6 | 2 | 2-4h | paralelo | ~4h |

**Total wall-clock estimado**: **~58h de trabalho de subagents** (≈ 2-3 dias úteis com 4-7 subagents concorrentes). Caminho crítico domina (Wave 4 BullMQ + Wave 5 Detail trio sequencial + Wave 3 #136→#137).

---

## 6. Métrica de sucesso (definition of done do plano)

Bullets concretos, todos verificáveis:

1. **0 issues abertas** nas milestones Phase 6 e Phase 7 (verificar: `gh issue list --state open --milestone "Phase 6..."` e idem Phase 7 retornam vazio).
2. **0 PRs Dependabot abertos** (verificar: `gh pr list --author "app/dependabot"` vazio).
3. **CI verde em `main`** (verificar: `gh run list --branch main --limit 1 --json conclusion`).
4. **Coverage**: ≥ 80% lines/functions, ≥ 75% branches em scope (verificar: `npm test -- --coverage` saída).
5. **HANDOFF.md** menciona Phase 6/7 e linka este spec.
6. **CLAUDE.md** atualizado em: `lib/queue/` (novo), `lib/dashboard/` (modificado), `lib/sites/` (modificado), `lib/leads/` (modificado), `components/sites/stock/`, `components/sites/about/`, `components/sites/contact/`, `components/sites/announce/`.
7. **Branches obsoletas removidas** (verificar: `git branch -r | wc -l` cai significativamente).
8. **Worker Redis rodando localmente** (`docker compose ps` mostra `gasp-search-redis` healthy).
9. **`sentry-skills:code-review` + `security-review` documentados** como comment em **cada** PR Phase 6 bug e em **todos** os PRs Phase 7 com lógica nova de servidor (Server Action / API route).
10. **Visual baseline tests verdes** (12 baselines × threshold 0.1%) no CI.

---

## 7. Próximo passo

Invocar `writing-plans` skill para gerar plano executável wave-a-wave, com prompts-template para subagents (1 prompt por PR), pontos de checkpoint pelo agente principal entre waves, e tarefas concretas em formato compatível com `subagent-driven-development`.

O plano executável deve referenciar este spec por URL/path e expandir cada wave em sub-tarefas verificáveis.
