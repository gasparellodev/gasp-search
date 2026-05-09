# `lib/campaigns/` — Spec Técnica

## Propósito

Helpers server-side de campanhas (Phase 5 + extensão Phase 7 M4.3). Concentra o processor inline que itera os `campaign_targets` aplicando throttle. A partir de #172 também roteia entre dois fluxos via `campaign.type`:

- `'message'` (default, Phase 5/6) — render template ou gera IA → `sendWhatsAppMessage`.
- `'site_preview'` (Phase 7 M4.3, #172) — fetch `lead_sites` por lead → `dispatchSitePreview` (que renderiza o template hard-coded `SITE_PREVIEW_TEMPLATE` e dispara via `sendWhatsAppMessage`).

## Como adicionar

- Server-only (`import "server-only"`).
- Tudo aqui delega a `lib/evolution/send.sendWhatsAppMessage`, `lib/evolution/templates.renderTemplate` (modo template do Phase 5) e `lib/sites/dispatch-site-preview.dispatchSitePreview` (modo `site_preview` do Phase 7) — não duplique lógica.
- Tests injetam `sleep`, `sendImpl`, `generateMessageImpl`, `dispatchSitePreviewImpl`, `serviceClient` para evitar timer real, API real e service-role real.

## Arquivos

| Path | Propósito |
|---|---|
| `processor.ts` | `processCampaign({ supabase, userId, campaignId, throttleMs, sleep, sendImpl, generateMessageImpl, dispatchSitePreviewImpl?, serviceClient? })` — atualiza `campaigns.status='running'/'completed'/'cancelled'`, itera `campaign_targets` pendentes, **branch entre `type='message'` (template/IA) e `type='site_preview'`** (dispatch helper), incrementa counters. Throttle padrão 3s. Checa cancelamento a cada iteração. |

## Branch `type='site_preview'`

Per-target loop:

1. Fetch `lead_sites` by `lead_id` via `dispatchSitePreview` helper.
2. Mapeia o resultado pra status do queue row:
   - `ok=true`                              → `'sent'` + counter `sent_count++`.
   - `reason='no_site'|'invalid_status'`    → `'skipped'` com `error_message='<reason>: <message>'`. **Não conta em failed** (lead inelegível, não erro de envio).
   - `reason='whatsapp_error'|'render_error'|'db_error'` → `'failed'` + counter `failed_count++`.
3. Throw inesperado dentro do helper é capturado e tratado como `db_error`.
4. Throttle entre cada target (mesmo padrão do branch `'message'`).

Não usa `campaign.mode`, `template_text`, `ai_*` — esses ficam null em campaigns `site_preview` (validador deve aceitar).

## Limitações conhecidas

- Tudo roda inline na request da rota POST `/api/campaigns` com `maxDuration=300`. Limite de 50 leads (validado em `lib/validators/campaigns`) mantém o tempo total dentro do envelope.
- Para campanhas maiores, fica a issue de Phase 5.5: migrar para Vercel Queues ou cron.
- M4.4 (#173) vai adicionar guard de 50/dia por user pra `type='site_preview'`.

## Dependências

- `@/lib/ai/anthropic`
- `@/lib/evolution/send`
- `@/lib/evolution/templates`
- `@/lib/sites/dispatch-site-preview`
- `@/lib/supabase/service`
- `@/lib/validators/ai`
- `@/types/database`
