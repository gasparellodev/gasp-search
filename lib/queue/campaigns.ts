import "server-only";
import { Queue, type JobsOptions } from "bullmq";

import { getRedis } from "./redis";

// ----------------------------------------------------------------------------
// Fila BullMQ — `campaign-targets`. Cada job é 1 target da campanha (lead a
// processar). Worker dedicado em `lib/queue/worker.ts` consome respeitando
// `concurrency: 1` + limiter de 1 msg/3s (anti-ban WhatsApp).
//
// V1 (este PR): worker via `npm run worker:campaigns` em terminal local.
// V2 (out-of-scope): worker dedicado em VM/container ou Vercel Background
// Functions. Decisão registrada no PR body.
//
// Retry policy: 3 tentativas com backoff exponencial 5s/30s/2min. Cobre
// erros transitórios de Anthropic (rate-limit 429) e Evolution (502 do
// container). Erros lógicos (lead removido, instância desconectada) viram
// `status='failed'` no campaign_target dentro do processor — sem retry.
// ----------------------------------------------------------------------------

export const CAMPAIGN_TARGETS_QUEUE_NAME = "campaign-targets" as const;

/**
 * Job payload — `(campaignId, leadId)` identifica unicamente a row em
 * `campaign_targets` (PK composta, sem coluna `id` sintética).
 */
export type CampaignTargetJob = {
  campaignId: string;
  userId: string;
  leadId: string;
};

export const campaignsQueue = new Queue<CampaignTargetJob>(
  CAMPAIGN_TARGETS_QUEUE_NAME,
  {
    connection: getRedis(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      // `removeOnComplete` evita acumular jobs completos na keyspace.
      // 1000 jobs / 7d cobre auditoria leve sem encher Redis.
      removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
      // Mantém jobs falhos por 30 dias para debugging.
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  },
);

export type EnqueueCampaignInput = {
  campaignId: string;
  userId: string;
  targets: ReadonlyArray<{ leadId: string }>;
};

/**
 * Enfileira N jobs (1 por target) usando `addBulk` (single round-trip ao
 * Redis). Cada job tem `jobId` determinístico `<campaignId>:<leadId>` para
 * idempotência: retry de enqueue (ex.: timeout no client) não duplica jobs.
 */
export async function enqueueCampaign({
  campaignId,
  userId,
  targets,
}: EnqueueCampaignInput): Promise<{ queuedTargets: number }> {
  if (targets.length === 0) return { queuedTargets: 0 };

  const entries: Array<{
    name: string;
    data: CampaignTargetJob;
    opts: JobsOptions;
  }> = targets.map((t) => ({
    name: "campaign-target",
    data: {
      campaignId,
      userId,
      leadId: t.leadId,
    },
    opts: {
      jobId: `${campaignId}:${t.leadId}`,
    },
  }));

  await campaignsQueue.addBulk(entries);
  return { queuedTargets: entries.length };
}
