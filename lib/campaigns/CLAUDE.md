# `lib/campaigns/` — Spec Técnica

## Propósito

Helpers server-side de campanhas (Phase 5). Concentra o processor inline que itera os `campaign_targets` aplicando throttle.

## Como adicionar

- Server-only (`import "server-only"`).
- Tudo aqui delega a `lib/evolution/send.sendWhatsAppMessage` e `lib/evolution/templates.renderTemplate` — não duplique lógica.
- Tests injetam `sleep`, `sendImpl`, `generateMessageImpl` para evitar timer real e API real.

## Arquivos

| Path | Propósito |
|---|---|
| `processor.ts` | `processCampaign({ supabase, userId, campaignId, throttleMs, sleep, sendImpl, generateMessageImpl })` — atualiza `campaigns.status='running'/'completed'/'cancelled'`, itera `campaign_targets` pendentes, renderiza template ou gera IA por lead, dispara via send, incrementa counters. Throttle padrão 3s. Checa cancelamento a cada iteração. |

## Limitações conhecidas

- Tudo roda inline na request da rota POST `/api/campaigns` com `maxDuration=300`. Limite de 50 leads (validado em `lib/validators/campaigns`) mantém o tempo total dentro do envelope.
- Para campanhas maiores, fica a issue de Phase 5.5: migrar para Vercel Queues ou cron.

## Dependências

- `@/lib/ai/anthropic`
- `@/lib/evolution/send`
- `@/lib/evolution/templates`
- `@/lib/validators/ai`
- `@/types/database`
