import "server-only";
import { Worker, type Job } from "bullmq";

import { processCampaignTarget } from "@/lib/campaigns/processor";
import { EVOLUTION_DEFAULT_THROTTLE_MS } from "@/lib/evolution/rate-limit";

import {
  CAMPAIGN_TARGETS_QUEUE_NAME,
  type CampaignTargetJob,
} from "./campaigns";
import { getRedis } from "./redis";

// ----------------------------------------------------------------------------
// Worker BullMQ — consome `campaign-targets` 1 a 1 respeitando throttle do
// Evolution (1 msg / 3s) para reduzir risco de ban heurístico do WhatsApp.
// O handler delega 100% para `processCampaignTarget` (pure-ish, server-only).
//
// V1 (este PR): processo Node standalone iniciado por `npm run worker:campaigns`.
// O dev sobe Redis (`docker compose up -d` em `docker/redis/`) e roda o worker
// em terminal separado durante desenvolvimento.
//
// V2 (out-of-scope): runtime dedicado — VM, Vercel Background Function, ou
// Fly Machine. Documentado em ADR no PR body de #122.
// ----------------------------------------------------------------------------

async function handler(job: Job<CampaignTargetJob>) {
  return processCampaignTarget(job.data);
}

export const worker = new Worker<CampaignTargetJob>(
  CAMPAIGN_TARGETS_QUEUE_NAME,
  handler,
  {
    connection: getRedis(),
    // 1 job por vez — Anthropic + Evolution não toleram concorrência alta.
    concurrency: 1,
    // Limiter casa com EVOLUTION_DEFAULT_THROTTLE_MS (3s) — 1 mensagem a
    // cada 3 segundos por instância. Refer to BullMQ docs:
    // https://docs.bullmq.io/guide/rate-limiting
    limiter: { max: 1, duration: EVOLUTION_DEFAULT_THROTTLE_MS },
  },
);

// Observabilidade básica — logs estruturados de ciclo de vida. Em V2 vamos
// plugar Sentry/OTEL aqui.
worker.on("completed", (job, result: unknown) => {
  const status =
    typeof result === "object" && result !== null && "status" in result
      ? String((result as { status: unknown }).status)
      : "ok";
  console.info(
    `[campaign-targets] job ${job.id} completed (status=${status})`,
    {
      campaignId: job.data.campaignId,
      leadId: job.data.leadId,
    },
  );
});

worker.on("failed", (job, err) => {
  console.error(
    `[campaign-targets] job ${job?.id ?? "?"} failed: ${err.message}`,
    {
      campaignId: job?.data.campaignId,
      leadId: job?.data.leadId,
      attemptsMade: job?.attemptsMade,
    },
  );
});

worker.on("error", (err) => {
  // Erros não-relacionados a um job específico (conexão Redis, etc.).
  console.error(`[campaign-targets] worker error: ${err.message}`);
});

// Graceful shutdown — necessário pra V1 dev: Ctrl+C no terminal do worker
// deve esperar o job atual terminar antes de fechar a connection.
const shutdown = async (signal: string) => {
  console.info(`[campaign-targets] received ${signal}, draining…`);
  try {
    await worker.close();
  } catch (err) {
    console.error(
      `[campaign-targets] error closing worker: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  process.exit(0);
};

if (typeof process !== "undefined" && process.on) {
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}
