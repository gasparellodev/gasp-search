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

const DEFAULT_INTERVAL_MS = 3_000;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

export function checkRateLimit(
  userId: string,
  intervalMs: number = DEFAULT_INTERVAL_MS,
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
