# `lib/campaigns/` — Spec Técnica

## Propósito

Helpers server-side de campanhas (Phase 5 + extensão Phase 7 M4.3 + Phase 6 fila durável em #122). A partir de #122 o loop inline foi **removido**: `lib/queue/campaigns.enqueueCampaign(...)` enfileira 1 job BullMQ por target, e o worker (`lib/queue/worker.ts`) chama `processCampaignTarget(...)` aqui dentro para cada job.

Roteamento por `campaign.type` continua igual:

- `'message'` (default, Phase 5/6) — render template ou gera IA → `sendWhatsAppMessage`.
- `'site_preview'` (Phase 7 M4.3, #172) — fetch `lead_sites` por lead → `dispatchSitePreview` (que renderiza o template hard-coded `SITE_PREVIEW_TEMPLATE` e dispara via `sendWhatsAppMessage`).

## Como adicionar

- Server-only (`import "server-only"`).
- Tudo aqui delega a `lib/evolution/send.sendWhatsAppMessage`, `lib/evolution/templates.renderTemplate` (modo template do Phase 5) e `lib/sites/dispatch-site-preview.dispatchSitePreview` (modo `site_preview` do Phase 7) — não duplique lógica.
- Tests injetam `sendImpl`, `generateMessageImpl`, `dispatchSitePreviewImpl`, `serviceClient` para evitar API real e service-role real. **Throttle não tem mais injeção** — vive na BullMQ Queue config (`limiter: { max: 1, duration: EVOLUTION_DEFAULT_THROTTLE_MS }`).

## Arquivos

| Path | Propósito |
|---|---|
| `processor.ts` | `processCampaignTarget(job: CampaignTargetJob, opts?)` — função pura-ish que processa **1 único target**. Lê `campaigns` (verifica `status='cancelled'` → retorna `{status:'cancelled'}` sem tocar nada), roteia por `type`, executa branch (`message` ou `site_preview`), grava `campaign_targets.status`, incrementa counter (`sent_count`/`failed_count`), conta pending restantes e marca `campaigns.status='completed'` se zerou (sem sobrescrever `cancelled`). Worker injeta service-role; testes injetam mock. |

## Branch `type='site_preview'`

Per-target loop:

1. Fetch `lead_sites` by `lead_id` via `dispatchSitePreview` helper (que já aplica `checkDailyInstanceLimit` #173).
2. Mapeia o resultado pra status do queue row:
   - `ok=true`                              → `'sent'` + counter `sent_count++`.
   - `reason='no_site'|'invalid_status'`    → `'skipped'` com `error_message='<reason>: <message>'`. **Não conta em failed** (lead inelegível, não erro de envio).
   - `reason='whatsapp_error'|'render_error'|'db_error'|'rate_limit_daily'` → `'failed'` + counter `failed_count++`.
3. Throw inesperado dentro do helper é capturado e tratado como `db_error`.
4. Throttle entre cada target (mesmo padrão do branch `'message'`).

**Por que `rate_limit_daily` é `failed` e não `skipped`?** Decisão V1 documentada na #173. `skipped` significa "lead inelegível" (sem site, status errado) — operador não precisa de ação. `rate_limit_daily` significa "instância atingiu hard limit anti-ban (50/dia)" — operador **precisa** ver pra retentar amanhã com awareness. Se fosse `skipped`, ficariam invisíveis na fila e o operador não entenderia por que a campanha de hoje "passou tão rápido".

Não usa `campaign.mode`, `template_text`, `ai_*` — esses ficam null em campaigns `site_preview` (validador deve aceitar).

## Status terminal (#131)

Após o loop, o processor decide o status final assim:

- `campaign.status === 'cancelled'` → mantém `cancelled` (estado terminal já gravado pelo PATCH de cancelamento).
- Caso contrário → grava `status = 'completed'` literal (sem ternário). "Completed" significa **rodou até o fim**, não que tudo deu certo.

Distinção entre sucesso total / sucesso parcial / falha total é feita pela UI lendo `campaign.failed_count` e `sent_count`. **Não existe** valor `completed_with_errors` no enum `campaign_status` — qualquer novo estado terminal exige migration + atualização de UI (decisão Opção 1 do body de #131, escolhida por minimizar churn).

Sentinelas no test:

- `#131: campanha com 100% falha termina com status 'completed'` trava o enum (não pode aparecer `failed`/`errored`/`completed_with_errors` em update de `campaigns`).
- `#131: sucesso parcial registra failed_count > 0 e ainda termina como 'completed'` confirma que `failed_count` é incrementado corretamente em parallel com o status terminal único.

## Queue boundary (#122)

- A rota `POST /api/campaigns` faz INSERT + chama `enqueueCampaign` em `lib/queue/campaigns.ts`. **Nunca** importe `processCampaignTarget` direto na rota — sempre passe pela fila para garantir retry/backoff e respeitar throttle.
- O worker (`lib/queue/worker.ts`) é único consumidor de `processCampaignTarget`. Em V1 dev: `npm run worker:campaigns` em terminal separado. Em V2 prod: ver `lib/queue/CLAUDE.md` (Vercel Cron / Background Functions / VM dedicada).
- `processCampaignTarget` deve ser **idempotente o suficiente** — re-run de 1 job (retry) recalcula o estado lendo `campaigns.status` e o lead. Único side-effect "perdido" em duplicação é uma mensagem WhatsApp enviada 2x (mitigado por `removeOnComplete` + `attempts=3`).

## Limitações conhecidas

- Validador `lib/validators/campaigns` mantém limite de 50 leads/campanha (Phase 6 pré-#122). Com fila durável o limite poderia subir, mas mantemos por enquanto para proteger budget Anthropic + UX (preview da fila na UI).
- V1 sem painel de fila (`bull-board`) — debug via `redis-cli` ou logs do worker. Phase 8 follow-up provável.

## Dependências

- `@/lib/ai/anthropic`
- `@/lib/evolution/send`
- `@/lib/evolution/rate-limit` (constante `EVOLUTION_DEFAULT_THROTTLE_MS`)
- `@/lib/evolution/templates`
- `@/lib/sites/dispatch-site-preview`
- `@/lib/supabase/service`
- `@/lib/queue/campaigns` (tipo `CampaignTargetJob`)
- `@/lib/validators/ai`
- `@/types/database`
