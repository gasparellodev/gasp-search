# `app/actions/` — Server Actions

## Propósito

Server Actions invocadas diretamente por Client Components, sem precisar
de uma rota REST dedicada em `app/api/`.

Diferente das API routes, Server Actions:
  - São tipadas estaticamente entre cliente e server.
  - Não exigem `fetch` no client — basta importar e chamar.
  - Não geram endpoint público GET-able.

Use Server Action quando a mutation:
  - É invocada por **um** componente específico do app (não API pública).
  - Não precisa de polling/webhook/batched ops.
  - Não vai ser consumida por integração externa.

Caso contrário, prefira API route REST em `app/api/`.

## Como adicionar

- 1 arquivo por ação (ou grupo coeso). Nome no formato `<recurso>.ts`,
  ex: `site-form.ts`.
- Primeira linha **DEVE** ser `'use server';` (caso contrário Next 16
  trata como código server normal e bloqueia chamada do client).
- Action é uma função `async` **exportada** com signature
  `(args...) => Promise<Result>`.
- Validação de input via Zod **obrigatória** — Server Actions são um
  endpoint público de fato (Next gera POST internamente).
- **Não retornar `Error`** — sempre `{ success: true, ... } |
  { success: false, error: string }`. Erros levantados são serializados
  pelo Next mas perdem stack útil em produção.
- **Sem PII em logs.** Mesmo que persistente, evite `console.log` de
  payloads que contêm email/telefone — defesa contra leak via
  observabilidade.

## Regras de negócio

1. **Auth via `createServerClient`** (de `@/lib/supabase/server`)
   quando a action depende de usuário autenticado. Para actions
   públicas (ex: `submitSiteForm`), não há sessão de usuário — usar
   `service-role` apenas para writes mínimas necessárias.
2. **Validação Zod antes de qualquer side effect.** Se `safeParse`
   falhar, retornar `{ success: false, error }` sem persistir.
3. **Nunca expor mensagens de erro do banco direto ao cliente.**
   Mapear para mensagens amigáveis em PT-BR.

## Arquivos

| Path | Propósito |
|---|---|
| `site-form.ts` | `submitSiteForm(siteId, payload, extras?)` — Server Action chamada pelo `<SiteForm>` público (#161) e pelo `<HomeContactFormQuick>` (#223). **#223 estende** com persistência em `lead_form_submissions` (migration 0020) via service-role, gated por `NEXT_PUBLIC_SITE_FORMS_ENABLED === '1'`; honeypot (`extras.honeypot`) e min-time gate (`extras.renderedAt` < 2000ms) que retornam silent success + `console.warn` PII-safe; rate limit por IP (`x-forwarded-for` → `x-real-ip` → null) 3 submissions/hora bloqueando com PT-BR; LGPD audit fields persistidos por submission (`consent_text`/`consent_ip`/`consent_user_agent`/`consent_timestamp`). Mantém shape `{ success: true } \| { success: false; error }` (não introduz discriminated union pra preservar compat com `<SiteForm>` v1 que ignora `extras`). **Decisão PO:** audit LGPD por submission (defensável juridicamente — cada lead capturado tem registro imutável do consentimento explícito no momento da coleta). |
| `consent-audit.ts` | `recordConsentDecision(input)` (#234) — Server Action chamada pelo `<CookieBanner>`. Valida action/categorias via Zod, resolve IP/UA pelos headers e delega para `lib/lgpd/consent-audit.ts:logConsent`. Retorna `{ok:true}` ou `{ok:false}`; não retorna erro de banco ao client e não loga IP/UA. |
| `site-announcement.ts` | `submitAnnouncement(siteId, payload)` — Server Action stub V1 chamada pelo `<AnnounceForm>` público (#163). Valida via `AnnouncementSchema` e retorna `{ ok: true } \| { ok: false; error }`. **Nota**: usa `ok` em vez de `success` (variação aprovada na issue #163 — a discriminated union shape do retorno está documentada inline). Persistência em `lead_announcements` é follow-up (tabela ainda não existe). Sem PII em logs. |
| `lead-site.ts` (`maxDuration` host) | **#217 — Phase 7 Sprint 2 #A3.** `'use server'` files NÃO podem exportar consts (Next 16 build error: "module has no exports at all"). O `maxDuration = 90` que estende o timeout pra `regenerateVisualIdentity` (#216) é declarado na rota que monta o Client Component que dispara a Action: `app/(app)/leads/[id]/page.tsx`. 90s dá folga sobre o target (~30-60s wallclock pra 9 imagens com `p-limit(2)`) sem ultrapassar o limite Vercel Pro (300s). |
| `lead-site.ts` (regenerateVisualIdentity) | **#216 — Phase 7 Sprint 2 #A2.** `regenerateVisualIdentity(leadSiteId, options?: {force?: boolean})` — gera identidade visual AI (9 banners) via OpenAI Images API. Pipeline: auth → fetch (RLS) → idempotência (`!force && visual_identity != null` → retorna existing) → `buildIdentityContext` (v1 ou v2 SiteVariables) → `buildAssetSpecsForCars` (filtra categorias presentes) → cost guardrail ($2 USD hard cap) → optional `deleteExistingAssets` (se force) → loop `p-limit(env.OPENAI_IMAGE_CONCURRENCY ?? 2)` com `generateImage` + `uploadAssetToStorage` → `VisualIdentityManifestSchema.parse` → UPDATE `lead_sites.visual_identity` via service_role → `updateTag(\`site:\${slug}\`)`. Retorno discriminado `RegenerateVisualIdentityResult = { ok: true; manifest; regenerated: boolean } \| { ok: false; error: 'auth' \| 'not_found' \| 'cost_guardrail' \| 'validation' \| 'generation_error' \| 'storage_error' \| 'db_error'; message }`. Telemetria PII-safe `{slug, asset_count, total_cost_usd, duration_ms, model_used, forced}`. |
| `lead-site.ts` | `generateLeadSite(leadId)` — orquestrador completo do M1.7 (#159, schema v2 desde #197 PR-C). Pipeline: auth → rate-limit (DB-backed) → fetch lead → brand assets (#156) → slug (#155) → IA copy (#158) → URL sanitization → **`SiteVariablesV2.parse`** → upsert lead_sites (`onConflict: 'user_id,lead_id'`) → `updateTag` + `revalidatePath`. Retorno discriminated union `{ ok: true; slug } \| { ok: false; error: 'auth' \| 'not_found' \| 'rate_limit' \| 'ai_error' \| 'validation' \| 'db_error'; message }`. Preserva slug em regen (links WhatsApp não quebram). Logs estruturados PII-safe em ≥4 steps. **Também exporta `updateLeadSiteVariables(leadSiteId, patch)`** (#168): pipeline auth → fetch row (RLS) → status guard (`'published' \| 'sent'`) → `SiteVariables.partial().safeParse` → `safeUrl` em URLs → merge shallow → `SiteVariables.parse` final → update via service_role → `updateTag` + `revalidatePath`. Retorno `{ ok: true; slug } \| { ok: false; error: 'auth' \| 'not_found' \| 'invalid_status' \| 'validation' \| 'db_error'; message }`. **`signLeadSite(leadSiteId)` (#232)**: pipeline auth → fetch row (RLS) → status guard (`'published' \| 'sent'`) → se `signed_at` já existe retorna `{ok:true,signed:false}` sem side effects → update service-role `signed_at=now` → `updateTag` + `revalidatePath` → `notifyIndexNow(urls)` best-effort para home/estoque/sobre/contato/anunciar + detalhe dos carros. Falha IndexNow vira `console.warn`, nunca bloqueia assinatura. **Mais `archiveLeadSite(leadSiteId)` e `restoreLeadSite(leadSiteId)`** (#169): ambas com pipeline auth → fetch row (RLS) → status guard → update via service_role → `updateTag` + `revalidatePath`. `archiveLeadSite` exige status `'published' \| 'sent'` e seta `status='archived'` + `archived_at=now`. `restoreLeadSite` exige status `'archived'` e seta `status='published'` + `archived_at=null`. Retorno compartilhado `LeadSiteStatusActionResult = { ok: true } \| { ok: false; error: 'auth' \| 'not_found' \| 'invalid_status' \| 'db_error'; message }`. **Mais `sendLeadSiteWhatsApp(leadSiteId)`** (#171): pipeline auth → fetch row (RLS) → status guard (`'published' \| 'sent'`, re-send permitido) → fetch `leads.name` → `renderTemplate(SITE_PREVIEW_TEMPLATE, { business_name, site_url })` → `sendWhatsAppMessage` (Phase 6 helper: insere `lead_messages`, chama Evolution sendText, atualiza status, promove `lead.stage`) → update via service_role `status='sent'`, `sent_at=now` → `updateTag` + `revalidatePath`. Retorno `SendLeadSiteWhatsAppResult = { ok: true } \| { ok: false; error: 'auth' \| 'not_found' \| 'invalid_status' \| 'whatsapp_error' \| 'db_error'; message }`. `whatsapp_error` carrega mensagem PT-BR mapeada do `reason` do helper Evolution (instance_disconnected / lead_missing_phone / evolution_error). |

## Dependências

- `zod` — schemas em `lib/...schema.ts`.
- `server-only` — implícito via `'use server'` do Next.
- `next/cache` — `updateTag`, `revalidatePath` para invalidação de cache em
  `lead-site.ts`. **`updateTag` (não `revalidateTag`)** em Server Actions —
  requer 1 arg só e tem semântica read-your-own-writes específica do
  contexto Server Action, alinhado com Next 16 cache-components.
  **#247 — 1 tag por Server Action**: `site:<slug>` (cache do `getSite`
  helper em `lib/sites/get-site.ts`). Os 5 caminhos (`generateLeadSite`,
  `updateLeadSiteVariables`, `archiveLeadSite`, `restoreLeadSite`,
  `signLeadSite`, `sendLeadSiteWhatsApp`) emitem somente essa tag — o opengraph-image
  (`app/sites/[slug]/opengraph-image.tsx` #213) e o llms.txt
  (`app/sites/[slug]/llms.txt/route.ts` #246) invalidam transitivamente
  via `getSite()` + ISR `revalidate = 3600` em cada handler. Tag dedicada
  `og:<slug>` foi removida em #247 (Next 16 exige `cacheTag` dentro de
  `"use cache"`, incompatível com Metadata files retornando `Response`).

## Mapa de erros (lead-site.ts)

### `generateLeadSite`

| Caminho | error | Persistido como |
|---|---|---|
| Sem auth | `auth` | n/a (não toca DB) |
| Lead inexistente / RLS | `not_found` | n/a (não toca DB) |
| 5+ tentativas em 60s | `rate_limit` | tentativa registrada antes do bloqueio |
| `GenerationError` (após 1 retry se retryable) | `ai_error` | `status='draft'` + `generation_error: '{ code, message, timestamp }'` |
| `SiteVariables.parse` falha | `validation` | `status='draft'` + `generation_error` (Zod issues) |
| `SlugCollisionError` | `db_error` | **NÃO** persiste — falha de infra |
| Upsert error (race em slug global) | `db_error` | n/a (commit falhou) |

### `updateLeadSiteVariables` (#168)

| Caminho | error | Persistido como |
|---|---|---|
| Sem auth | `auth` | n/a |
| Site inexistente / RLS bloqueia | `not_found` | n/a |
| Status ≠ `'published'` e ≠ `'sent'` | `invalid_status` | n/a (defesa em profundidade — UI já bloqueia) |
| `SiteVariables.partial()` falha em campos do patch | `validation` | n/a |
| `SiteVariables.parse(merged)` final falha (URL maliciosa virou null/empty, etc.) | `validation` | n/a (sem update) |
| Update DB error | `db_error` | n/a |

### `archiveLeadSite` (#169)

| Caminho | error |
|---|---|
| Sem auth | `auth` |
| Site inexistente / RLS bloqueia | `not_found` |
| Status ≠ `'published'` e ≠ `'sent'` (ex: `'draft'` ou `'archived'`) | `invalid_status` |
| Update DB error | `db_error` |

Sucesso → `{ ok: true }`. Persistência: `status='archived'`, `archived_at=now`, `updated_at=now`.

### `restoreLeadSite` (#169)

| Caminho | error |
|---|---|
| Sem auth | `auth` |
| Site inexistente / RLS bloqueia | `not_found` |
| Status ≠ `'archived'` (ex: `'published'`, `'sent'`, `'draft'`) | `invalid_status` |
| Update DB error | `db_error` |

Sucesso → `{ ok: true }`. Persistência: `status='published'`, `archived_at=null`, `updated_at=now`.

### `sendLeadSiteWhatsApp` (#171, #173)

| Caminho | error |
|---|---|
| Sem auth | `auth` |
| Site inexistente / RLS bloqueia | `not_found` |
| Status ≠ `'published'` e ≠ `'sent'` (ex: `'draft'`, `'archived'`) | `invalid_status` |
| `checkDailyInstanceLimit` retorna `allowed: false` (count >= 50 outbound em 24h) | `rate_limit_daily` (#173 — anti-ban WhatsApp) |
| `renderTemplate` lança (variável faltante) | `whatsapp_error` |
| `sendWhatsAppMessage` retorna `instance_disconnected` / `lead_not_found` / `lead_missing_phone` / `evolution_error` | `whatsapp_error` (com `message` mapeada PT-BR) |
| Update lead_sites pós-envio falha | `db_error` |

Sucesso → `{ ok: true }`. Persistência: `lead_sites.status='sent'`, `sent_at=now`, `updated_at=now`. **Re-send permitido** (status `'sent'` aceito como input). Cada chamada insere uma nova entrada em `lead_messages` (timeline) via `sendWhatsAppMessage`.

**Ordem de checks**: auth → fetch (RLS) → status guard → daily-limit guard → render → send. O guard `rate_limit_daily` roda **depois** de status guard (não desperdiça query em sites não-elegíveis) e **antes** do render+send (zero risco de tocar Evolution acima do hard limit).

**Logs PII-safe**: errorName + errorMessage + reason (Evolution). Não loga conteúdo da mensagem nem telefone do destinatário.

### `regenerateVisualIdentity` (#216)

| Caminho | error | Persistido como |
|---|---|---|
| Sem auth | `auth` | n/a |
| Site inexistente / RLS bloqueia | `not_found` | n/a |
| `buildIdentityContext` falha (business_name vazio, shape ruim) | `validation` | n/a |
| Estimativa de custo > $2 USD (hard cap V1) | `cost_guardrail` | n/a (sem chamar OpenAI) |
| `deleteExistingAssets` falha (force=true) | `storage_error` | n/a |
| `generateImage` lança `ImageGenerationError` (rate_limit persistente, moderation, etc) | `generation_error` | n/a — manifest antigo preservado |
| `uploadAssetToStorage` lança erro genérico | `storage_error` | n/a |
| `VisualIdentityManifestSchema.parse` final falha (URLs inválidas pós-upload) | `validation` | n/a |
| Update `lead_sites.visual_identity` DB error | `db_error` | n/a |

Sucesso → `{ ok: true; manifest; regenerated: boolean }`. `regenerated=false`
quando idempotência retorna manifest existente sem chamar OpenAI. Persistência
(quando regenerated=true): `lead_sites.visual_identity = manifest` validado +
`updated_at=now`. Sempre invalida cache via `updateTag(\`site:\${slug}\`)`.

**Custo target V1**: ~$0.49 USD/cliente (1-9 imagens dependendo de quantas
categorias estão presentes nos cars). Conversão BRL via `env.BRL_RATE` (default 5.0).

**Concorrência**: `p-limit(env.OPENAI_IMAGE_CONCURRENCY ?? 2)` — Tier-1
OpenAI tem 5 IPM, default 2 é safe. Aumentar quando subir Tier.

**Fallback de modelo** (`gpt-image-2` → `gpt-image-1-mini`) é responsabilidade
do caller via override em `generateImage({model: ...})`. Em V1 não há fallback
automático no nível desta action — manifest antigo é preservado em qualquer
falha persistente, e o admin pode tentar regenerar manualmente (force=true).

## Quando atualizar este `CLAUDE.md`

- Nova Server Action adicionada.
- Mudança em padrão de retorno (`Result` shape).
- Padrão novo de auth (ex: token-based) introduzido.
