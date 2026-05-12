# Redis local (gasp-search)

Redis 7-alpine na porta **6380** (host) → 6379 (container). Não conflita com `gasp-evolution-redis` em `docker/evolution/` (também 6379 interno, mas container/porta isolados).

## Propósito

Backend ephemeral para:

- **BullMQ** (issue #122) — fila durável de jobs de campanhas (`campaign-targets`).
- **Presença WhatsApp** (issue #123) — TTL 60s para `typing/online/last_seen` por lead.
- Outras estruturas K/V de runtime (rate-limit por user, cache curto, etc.).

## Subir

```bash
cd docker/redis
docker compose up -d
docker compose ps
redis-cli -p 6380 ping
# esperado: PONG
```

## Parar

```bash
cd docker/redis
docker compose down
# para remover o volume (perde dados de fila):
docker compose down -v
```

## Configuração

- **Append-only persistence** ligado (`--appendonly yes`) — durabilidade entre restarts.
- **Maxmemory 256MB** com policy `allkeys-lru` (descarta menos usados quando cheio).
- **Volume nomeado** `redis-data` — preserva fila e presença entre `down`/`up`.
- **Healthcheck** a cada 10s via `redis-cli ping`.

## Uso no código

- `lib/queue/redis.ts` (issue #122) consome `REDIS_URL` do `.env.local` (default `redis://localhost:6380`).
- `lib/queue/campaigns.ts` registra `Queue<CampaignTargetJob>('campaign-targets')`.
- `npm run worker:campaigns` inicia processo Node que consome jobs (V1 dev; V2 prod fica out-of-scope deste plano).

## Não usar em produção (V1)

Esta config é dev-only:

- Sem auth (`bind 0.0.0.0` exposto via Docker port mapping — só funciona localhost).
- Sem TLS.
- Sem replicação.

Para V2 produção, considerar Upstash Redis (managed), Vercel KV, ou Redis Cloud com auth + TLS.

Ver `lib/queue/CLAUDE.md` (criado em #122) para arquitetura completa.
