# `lib/queue/` — Spec Técnica

## Propósito

Fila durável BullMQ + ioredis (issue #122, Phase 6). Substituiu o processor inline de campanhas que rodava na rota `POST /api/campaigns` com `maxDuration = 300`. Cada `campaign_target` agora vira um job; um worker dedicado consome respeitando throttle anti-ban (1 msg/3s) e atualiza counters em `campaigns` — disparando o realtime que a UI `/campaigns/[id]` assina.

## Como adicionar

- Server-only (`import "server-only"`).
- Novas filas vão em `lib/queue/<dominio>.ts` exportando o Queue + helpers (`enqueueX`).
- Workers vão em `lib/queue/worker-<dominio>.ts` ou agrupados em `lib/queue/worker.ts` quando compartilham config (concurrency, limiter, connection).
- **Não importe `bullmq` direto em rotas/handlers** — sempre passe por `enqueueX` para garantir `jobId` determinístico + `defaultJobOptions` consistente.

## Arquivos

| Path | Propósito |
|---|---|
| `redis.ts` | **Server-only.** Singleton ioredis client. `getRedis()` reusa conexão entre `Queue`, `Worker`, e futuros consumidores (presença WhatsApp #123). `maxRetriesPerRequest: null` é REQUISITO BullMQ. Aceita `redis://` (V1 local) e `rediss://` (V2 prod). `_resetRedis()` é helper exclusivo de testes. |
| `campaigns.ts` | **Server-only.** `Queue<CampaignTargetJob>('campaign-targets')` + `enqueueCampaign({ campaignId, userId, targets })` → `{ queuedTargets }`. Usa `addBulk` (single round-trip Redis) com `jobId = '<campaignId>:<targetId>'` para idempotência. Retry policy `attempts=3` + backoff exponencial 5s. `removeOnComplete` 7d/1000 jobs; `removeOnFail` 30d. |
| `worker.ts` | **Server-only.** Entry-point do worker (`npm run worker:campaigns` → `tsx lib/queue/worker.ts`). `Worker('campaign-targets', handler, { concurrency: 1, limiter: { max: 1, duration: 3000 } })` delega 100% para `processCampaignTarget(job.data)`. Listeners `completed`/`failed`/`error` para logs estruturados. SIGINT/SIGTERM faz `worker.close()` graceful. |

## Contrato `CampaignTargetJob`

```ts
type CampaignTargetJob = {
  campaignId: string;
  campaignTargetId: string;  // PK da row em campaign_targets
  userId: string;            // proprietário da campanha (RLS scope)
  leadId: string;            // FK para o lead
};
```

## V1 vs V2 (ADR)

### V1 (este PR — #122)

- Worker é processo Node standalone iniciado por `npm run worker:campaigns`.
- Dev sobe Redis com `cd docker/redis && docker compose up -d` e roda o worker em terminal separado.
- Redis **sem auth/TLS** — container exposto só em `localhost:6380` via Docker port-mapping; não acessível da rede externa.
- Sem replicação: dump/restore manual via `docker exec gasp-search-redis redis-cli SAVE` se precisar.

### V2 (out-of-scope deste PR — phase 8 issue follow-up)

Alternativas para produção:

1. **Upstash Redis** (managed, free tier 256MB / 10K commands/dia). `rediss://`-only, auth via URL. Funciona com Vercel sem mudança de código.
2. **Vercel KV** — wrapper Upstash com integração nativa Vercel (auto-provision via Marketplace).
3. **Redis Cloud** ou **Fly Redis** — quando precisar de mais throughput.

Worker em V2:

- **Não roda em Vercel Functions** (timeout 300s + cold start não combina com worker persistente).
- Opções: VM dedicada (Fly Machine, Hetzner), Background Function (Vercel Background ou Inngest), ou Vercel Cron disparando enqueue/process em chunks.
- Decisão final depende do volume (estimativa: < 500 jobs/dia em V2 inicial → Vercel Cron + processCampaignTarget em batch funciona).

## Trust boundary (security)

- `CampaignTargetJob.userId` e `.leadId` são **trusted** — produzidos por `POST /api/campaigns` após `auth.getUser()` + validação de ownership via `.eq('user_id', user.id)` na query de leads.
- Worker usa Supabase **service_role** (sem cookies de sessão). Filtros explícitos por `user_id`/`lead_id` são responsabilidade do código chamado (mesmo padrão do webhook do Evolution).
- Redis em V1 **sem auth**: aceitável porque o bind é local-only via Docker. Em V2 prod, `REDIS_URL` com auth + TLS é mandatório (validador Zod aceita `rediss://`).

## Limitações conhecidas

- Sem auth Redis em V1 — local-only é aceitável; expor 6380 publicamente quebraria isolamento.
- Worker single-process — `concurrency: 1` é proposital (Anthropic + Evolution rate-limit). Horizontal scaling exigiria worker pool com limiter compartilhado.
- Reconexão durante job em execução pode causar duplicação se o job não for idempotente — `processCampaignTarget` é (quase) idempotente porque sempre lê o estado atual antes de qualquer UPDATE.

## Dependências

- `bullmq` (^5.76)
- `ioredis` (^5.10)
- `tsx` (devDep — runner do worker)
- `@/lib/env` (REDIS_URL)
- `@/lib/campaigns/processor` (`processCampaignTarget`)
- `@/lib/evolution/rate-limit` (`EVOLUTION_DEFAULT_THROTTLE_MS`)
