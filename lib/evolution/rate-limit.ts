import "server-only";

// Rate-limit in-memory por usuário para envio de mensagem WhatsApp.
// Evita ban do WhatsApp por flood. Padrão: 1 mensagem a cada 3 segundos.
//
// Limitações conhecidas (aceitáveis para o MVP):
//   - Estado vive no processo: instâncias serverless distintas têm contadores
//     próprios. Em prod isso atenua mas não bloqueia 100%.
//   - Uso por campanha bypassa este limite — campanhas têm throttle próprio
//     (sleep entre envios) controlado pelo processor.

type Bucket = { lastSentAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Throttle default (em ms) entre envios outbound do Evolution API.
 *
 * Compartilhado por:
 *   - `checkRateLimit` (rate-limit 1-a-1 da rota `/api/whatsapp/send`).
 *   - `processCampaign` (sleep entre targets no processor de campanha).
 *
 * Single source para evitar magic `3_000` espalhado (#138a). 3s mantém
 * margem confortável vs ban heurístico do WhatsApp (~1msg/s sustentado).
 */
export const EVOLUTION_DEFAULT_THROTTLE_MS = 3_000;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

export function checkRateLimit(
  userId: string,
  intervalMs: number = EVOLUTION_DEFAULT_THROTTLE_MS,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(userId);
  if (!bucket) {
    buckets.set(userId, { lastSentAt: now });
    return { ok: true };
  }
  const elapsed = now - bucket.lastSentAt;
  if (elapsed >= intervalMs) {
    bucket.lastSentAt = now;
    return { ok: true };
  }
  return { ok: false, retryAfterMs: intervalMs - elapsed };
}

// Helper para tests: limpa o estado in-memory.
export function _resetRateLimit() {
  buckets.clear();
}
