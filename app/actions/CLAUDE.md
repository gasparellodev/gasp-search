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
| `site-form.ts` | `submitSiteForm(siteId, payload)` — Server Action chamada pelo `<SiteForm>` público (#161). MVP: stub que valida via `SiteFormSchema` e retorna `{ success: true }`. Persistência em `site_form_submissions` é follow-up. |
| `site-announcement.ts` | `submitAnnouncement(siteId, payload)` — Server Action stub V1 chamada pelo `<AnnounceForm>` público (#163). Valida via `AnnouncementSchema` e retorna `{ ok: true } \| { ok: false; error }`. **Nota**: usa `ok` em vez de `success` (variação aprovada na issue #163 — a discriminated union shape do retorno está documentada inline). Persistência em `lead_announcements` é follow-up (tabela ainda não existe). Sem PII em logs. |
| `lead-site.ts` | `generateLeadSite(leadId)` — orquestrador completo do M1.7 (#159). Pipeline: auth → rate-limit (DB-backed) → fetch lead → brand assets (#156) → slug (#155) → IA copy (#158) → URL sanitization → SiteVariables.parse → upsert lead_sites (`onConflict: 'user_id,lead_id'`) → `updateTag` + `revalidatePath`. Retorno discriminated union `{ ok: true; slug } \| { ok: false; error: 'auth' \| 'not_found' \| 'rate_limit' \| 'ai_error' \| 'validation' \| 'db_error'; message }`. Preserva slug em regen (links WhatsApp não quebram). Logs estruturados PII-safe em ≥4 steps. **Também exporta `updateLeadSiteVariables(leadSiteId, patch)`** (#168): pipeline auth → fetch row (RLS) → status guard (`'published' \| 'sent'`) → `SiteVariables.partial().safeParse` → `safeUrl` em URLs → merge shallow → `SiteVariables.parse` final → update via service_role → `updateTag` + `revalidatePath`. Retorno `{ ok: true; slug } \| { ok: false; error: 'auth' \| 'not_found' \| 'invalid_status' \| 'validation' \| 'db_error'; message }`. **Mais `archiveLeadSite(leadSiteId)` e `restoreLeadSite(leadSiteId)`** (#169): ambas com pipeline auth → fetch row (RLS) → status guard → update via service_role → `updateTag` + `revalidatePath`. `archiveLeadSite` exige status `'published' \| 'sent'` e seta `status='archived'` + `archived_at=now`. `restoreLeadSite` exige status `'archived'` e seta `status='published'` + `archived_at=null`. Retorno compartilhado `LeadSiteStatusActionResult = { ok: true } \| { ok: false; error: 'auth' \| 'not_found' \| 'invalid_status' \| 'db_error'; message }`. **Mais `sendLeadSiteWhatsApp(leadSiteId)`** (#171): pipeline auth → fetch row (RLS) → status guard (`'published' \| 'sent'`, re-send permitido) → fetch `leads.name` → `renderTemplate(SITE_PREVIEW_TEMPLATE, { business_name, site_url })` → `sendWhatsAppMessage` (Phase 6 helper: insere `lead_messages`, chama Evolution sendText, atualiza status, promove `lead.stage`) → update via service_role `status='sent'`, `sent_at=now` → `updateTag` + `revalidatePath`. Retorno `SendLeadSiteWhatsAppResult = { ok: true } \| { ok: false; error: 'auth' \| 'not_found' \| 'invalid_status' \| 'whatsapp_error' \| 'db_error'; message }`. `whatsapp_error` carrega mensagem PT-BR mapeada do `reason` do helper Evolution (instance_disconnected / lead_missing_phone / evolution_error). |

## Dependências

- `zod` — schemas em `lib/...schema.ts`.
- `server-only` — implícito via `'use server'` do Next.
- `next/cache` — `updateTag`, `revalidatePath` para invalidação de cache em
  `lead-site.ts`. **`updateTag` (não `revalidateTag`)** em Server Actions —
  requer 1 arg só e tem semântica read-your-own-writes específica do
  contexto Server Action, alinhado com Next 16 cache-components.

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

### `sendLeadSiteWhatsApp` (#171)

| Caminho | error |
|---|---|
| Sem auth | `auth` |
| Site inexistente / RLS bloqueia | `not_found` |
| Status ≠ `'published'` e ≠ `'sent'` (ex: `'draft'`, `'archived'`) | `invalid_status` |
| `renderTemplate` lança (variável faltante) | `whatsapp_error` |
| `sendWhatsAppMessage` retorna `instance_disconnected` / `lead_not_found` / `lead_missing_phone` / `evolution_error` | `whatsapp_error` (com `message` mapeada PT-BR) |
| Update lead_sites pós-envio falha | `db_error` |

Sucesso → `{ ok: true }`. Persistência: `lead_sites.status='sent'`, `sent_at=now`, `updated_at=now`. **Re-send permitido** (status `'sent'` aceito como input). Cada chamada insere uma nova entrada em `lead_messages` (timeline) via `sendWhatsAppMessage`.

**Logs PII-safe**: errorName + errorMessage + reason (Evolution). Não loga conteúdo da mensagem nem telefone do destinatário.

## Quando atualizar este `CLAUDE.md`

- Nova Server Action adicionada.
- Mudança em padrão de retorno (`Result` shape).
- Padrão novo de auth (ex: token-based) introduzido.
