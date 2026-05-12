# `lib/` — Spec Técnica

## Propósito

Código server-side e utilitários compartilhados (não-componentes). Inclui clients (Supabase, Apify, Anthropic), validators (Zod), e helpers puros.

## Como adicionar

- **Client/factory** (Supabase, Apify, Anthropic): pasta com nome do serviço (`supabase/`, `apify/`, `ai/`).
- **Validators**: `lib/validators/<recurso>.ts` exportando schemas Zod.
- **Helpers puros**: `lib/<topico>.ts` (e.g., `lib/utils.ts`, `lib/env.ts`).
- **Sempre** com testes unitários em `tests/unit/lib/<...>.test.ts`. TDD: teste antes da implementação.

## Regras de negócio

1. **Server-only por padrão.** Arquivos em `lib/` que tocam tokens privados (`SUPABASE_SERVICE_ROLE_KEY`, `APIFY_TOKEN`, `ANTHROPIC_API_KEY`) **NÃO** devem ser importados por Client Components. Use marker `import "server-only"` no topo desses arquivos.
2. **`createServerClient` lê cookies do request** — não pode ser usado em código que roda fora de um request handler / Server Component. Não cachear instância.
3. **Validators são fonte da verdade do shape**. API routes e Server Actions sempre validam input via Zod antes de qualquer side effect.
4. **`lib/utils.cn`** é o único helper de classe condicional para Tailwind. Importar dele em todo lugar.
5. **Sem `any`** — preferir `unknown` + narrowing.
6. **Erros de I/O lançam erros tipados** (e.g., `class ApifyRunError extends Error`); o handler de API converte em response amigável.

## Arquivos

| Path | Propósito |
|---|---|
| `utils.ts` | `cn()` = `twMerge(clsx(...))`, default helper de classe |
| `env.ts` | **Server-only.** Zod validator de todas as envs (públicas e server). Lança no boot se algo faltar/inválido. Importa `server-only`. `INDEXNOW_KEY` é opcional e string vazia vira `undefined` para builds sem IndexNow. |
| `env-public.ts` | Validator das envs `NEXT_PUBLIC_*` apenas. Safe para Client Components. Lê `process.env.NEXT_PUBLIC_*` por chave (Next inlina). |
| `api/errors.ts` | Helper de erro para API routes com log estruturado (`requestId`, `route`, `userId`) e resposta amigável sem stack. |
| `validators/search.ts` | Schemas Zod para entradas das buscas Apify |
| `validators/whatsapp.ts` | Schemas Zod para envio WhatsApp e respostas do Evolution API |
| `evolution/client.ts` | Wrapper REST do Evolution API (`createEvolutionClient`) + `EvolutionApiError` |
| `evolution/templates.ts` | `renderTemplate`/`validateTemplate` para campanhas modo template (`extractPlaceholders` é interno desde #138a) |
| `evolution/phone.ts` | `normalizePhone(raw)` canônico — 8–15 dígitos, E.164 sem `+`. Reusado por `send.ts` e `webhook.ts` (#138a) |
| `campaigns/processor.ts` | `processCampaignTarget(job, opts?)` — **#122**: processa 1 único target da fila BullMQ. Branch `message`/`site_preview`, atualiza `campaign_targets.status`, incrementa counters, marca `campaigns` como `completed` quando zera os pending. Loop inline removido — agora cada target é 1 job. |
| `queue/redis.ts` | **#122 / Server-only.** Singleton `ioredis` client com `maxRetriesPerRequest: null` (requisito BullMQ). Consumido por `queue/campaigns.ts`, `queue/worker.ts` e (futuro) `whatsapp/presence.ts` (#123). |
| `queue/campaigns.ts` | **#122 / Server-only.** `Queue<CampaignTargetJob>('campaign-targets')` + `enqueueCampaign({campaignId, userId, targets}) → {queuedTargets}`. `jobId` determinístico (`<campaignId>:<targetId>`) para idempotência. Retry 3x backoff exponencial. |
| `queue/worker.ts` | **#122 / Server-only.** Entry-point do worker BullMQ (`npm run worker:campaigns`). `concurrency: 1` + `limiter: max=1 duration=3000ms` (anti-ban WhatsApp, reusa `EVOLUTION_DEFAULT_THROTTLE_MS`). Delega para `processCampaignTarget`. Graceful SIGINT/SIGTERM. |
| `validators/campaigns.ts` | Schemas Zod de criação (com refine por modo) e atualização (cancel) de campanhas |
| `ai/anthropic.ts` | **Server-only.** Singleton Anthropic + `generateMessage()` com system prompt cacheado e payload whitelisted do lead |
| `dashboard/summary.ts` | **Server-only.** Agrega métricas e últimas buscas do dashboard |
| `dashboard/types.ts` | Tipos compartilháveis com Client Components do dashboard |
| `og/load-geist.ts` | **Server-only, Edge-compatible.** Carrega `/fonts/geist-600.woff2` do próprio deployment para OG images com timeout de 1s, memoização por isolate e fallback `null`; evita GitHub raw/CDN e evita embutir o WOFF2 no Edge bundle. |
| `seo/indexnow.ts` | **Server-only.** `notifyIndexNow(urls)` — batch de URLs públicas assinadas para IndexNow/Bing/Yandex/Naver, 10 URLs por POST, best-effort com `console.warn` em falha. |
| `lgpd/consent-state.ts` | Constantes/tipos client+server-safe do consentimento LGPD dos sites públicos (`gasp_consent_v1`, versão `v1`, action/categorias e parser defensivo de `localStorage`). |
| `lgpd/consent-audit.ts` | **Server-only.** `logConsent(input)` persiste decisões do banner em `consent_logs` via service-role. Falha retorna `{ok:false}` e loga só action/version/erro de infra. |
| `sites/slug.ts` | `generateUniqueSlug(business_name, client)` — `<nanoid8>-<base>` único globalmente em `lead_sites.slug`. Cliente Supabase recebido por DI. Também exporta `slugifyVehicle({brand,model,year,id})` para slugs de detalhe de veículo no formato `{brand}-{model}-{year}-{id4}` (#232). |
| `sites/errors.ts` | `SlugCollisionError` — erro tipado com `attempts`/`business_name` para o gerador de slug. |
| `utils/slug.ts` | `slugify(input)` puro — NFKD, lowercase, hífens, fallback `'lead'`. Reusável fora do dominio sites. |
| `openai/image-client.ts` | **Server-only.** Phase 7 Sprint 2 #A2 (issue #216). Adapter pra `OpenAI().images.generate(...)` com singleton lazy + Zod input validation + erros tipados (`ImageGenerationError {code, retryable, status, model}`) + fallback automático `1792x1024 → 1536x1024` em invalid_size. NÃO passa `response_format` (spike bug #1). `maxRetries: 0` — caller decide retry. Pricing snapshot-locked em `PRICING_USD`. Modelo default pinado via `env.OPENAI_IMAGE_MODEL` (`gpt-image-2-2026-04-21`). |
| `sites/visual-identity.ts` | **Server-only.** Phase 7 Sprint 2 #A2 (issue #216). Pipeline de identidade visual AI por site — 9 specs V1 matching schema #215 (1 hero + até 6 categories + 1 about + 1 contact). Helpers puros (`buildAssetSpecsForCars`, `buildPrompt`, `buildIdentityContext`, `estimateTotalCost`) + I/O via service-role (`uploadAssetToStorage`, `deleteExistingAssets`). Custo target ~$0.49 USD/cliente. Ver detalhes em `lib/sites/CLAUDE.md`. |
| `finance.ts` | **Pure helpers — sem I/O.** Site Generator Sprint 0 / #F4 (issue #201) + Sprint 4 / #H2 (issue #222). Exporta `calculateInstallment` (Tabela PRICE com edge cases e throws para input inválido), `formatBRL` (BRL pt-BR, default `maximumFractionDigits: 0`, opção `{ fractionDigits }`), `slugifyVehicle` (`{brand}-{model}-{year}` NFKD-normalizado, casa regex `/^[a-z0-9-]+$/` de `SiteCar.slug`). Constantes `DEFAULT_MONTHLY_INTEREST = 0.0199` (1.99% a.m. — média BR CDC seminovos 2026), `DEFAULT_CARD_INSTALLMENT_MONTHS = 48`, `DEFAULT_CARD_DOWN_PCT = 20`. **`DISCLAIMER_TEXT`** (#222): string PT-BR `"Sujeito a aprovação de crédito. Taxas variam conforme análise de crédito."` — compliance CDC art. 52 + Bacen Res. 4.880/2020. Single source of truth para todo surface que exibe simulação (`<CarCard>`, `<HomeFinancingWidget>`, `<CarDetail>` price-block). Variação de wording entre páginas é red flag jurídico. Reusado em `<CarCard>` (#F4), `<HomeFinancingWidget>` (H2 Sprint 4), `<StockGrid>` card (E2 Sprint 5), `<CarDetail>` price-block (D2 Sprint 6). **TODO V2**: `slugifyVehicle` aceita colisão (sem disambig hash) — caller já tem slug único upstream via `car.slug`. |
| `stock/` | **Pure helpers — sem I/O.** Phase 7 Sprint 5 / #E2 (issue #225). `sort.ts` define as 5 opções públicas do sort (`most_recent`, `price_asc`, `price_desc`, `installment_asc`, `km_asc`) e `sortCars` imutável; `pagination.ts` define `paginate`, `parseStockPage` e `STOCK_PAGE_SIZE=12` para `?page=N`. Client-safe para `<StockClientView>`. Ver `lib/stock/CLAUDE.md`. |
| `hooks/` | **Client-safe hooks.** Hooks React compartilhados por componentes client. #220 adiciona `use-floating-cta-visibility.ts` (observa `body[data-modal-open]`) e `use-car-context.ts` (normaliza contexto serializado do detalhe do carro e monta WhatsApp `vehicle`). #234 adiciona `use-consent.ts` (SSR-safe via `useSyncExternalStore`, lê `localStorage` e evento custom no mesmo tab). Ver `lib/hooks/CLAUDE.md`. |

> A medida que features chegam:
> - `supabase/server.ts`, `client.ts`, `middleware.ts` (#9)
> - `apify/client.ts`, `run-and-persist.ts`, `google-maps.ts`, `instagram.ts`, `enrich.ts` (#13–#26)
> - `validators/lead.ts` (#21–#22)

## Env: regras críticas

1. **Em qualquer arquivo do `lib/` que toca segredo, faça `import "server-only"` na primeira linha.** Isso impede o bundle pegar acidentalmente em Client Component.
2. **`env` é o único ponto de leitura de `process.env`** em código server. Evite ler `process.env.X` espalhado.
3. **Para Client Components** que precisam de URL pública (e.g., redirect OAuth), importem `publicEnv` de `lib/env-public`.
4. URLs validadas com refine para http/https — bloqueia `javascript:`, `data:`, etc.

## Dependências

- `clsx` + `tailwind-merge` (utils)
- `@supabase/supabase-js`, `@supabase/ssr`
- `apify-client`
- `@anthropic-ai/sdk`
- `zod`
