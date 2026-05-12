import "server-only";
import Redis, { type Redis as RedisClient, type RedisOptions } from "ioredis";

import { env } from "@/lib/env";

// ----------------------------------------------------------------------------
// Singleton ioredis client compartilhado pela fila BullMQ (#122) e por outros
// consumidores futuros (presença WhatsApp #123, rate-limit, cache curto).
//
// Decisões:
//   - `maxRetriesPerRequest: null` é REQUISITO BullMQ. Sem isso, o worker
//     fica preso em retries internos do ioredis e nunca processa jobs em
//     reconexões. Ref: https://docs.bullmq.io/guide/connections
//   - `enableReadyCheck: false` opcional para acelerar boot em Upstash (V2);
//     em V1 dev local fica default `true` — connection idle não impacta.
//   - Aceita `redis://` (V1 local) e `rediss://` (V2 Upstash/Redis Cloud).
//   - **Sem auth/TLS em V1**: o container roda em `localhost:6380` exposto só
//     via Docker port-mapping (não acessível da rede). Em V2 prod, a URL
//     traz `:password@` e/ou `rediss://` — sem mudança de código.
// ----------------------------------------------------------------------------

let _client: RedisClient | null = null;

const BASE_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: null,
  // BullMQ recomenda manter a connection viva mesmo sem comandos pendentes.
  enableReadyCheck: true,
};

export function getRedis(): RedisClient {
  if (!_client) {
    _client = new Redis(env.REDIS_URL, BASE_OPTIONS);
  }
  return _client;
}

/**
 * Helper exclusivo para testes — libera o singleton para que um novo client
 * seja construído. Não use em runtime: encerrar/reconstruir conexão por
 * request é antipadrão (BullMQ assume connection longa).
 */
export function _resetRedis(): void {
  _client = null;
}
