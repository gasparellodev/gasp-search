import "server-only";

import { getRedis } from "@/lib/queue/redis";

export const WHATSAPP_PRESENCE_TTL_SECONDS = 60;

export type LeadPresence = "typing" | "paused" | "online" | "offline";

export type LeadPresenceSnapshot = {
  presence: LeadPresence;
  lastSeen: string | null;
};

type PresenceInput = {
  userId: string;
  leadId: string;
};

function presenceKey({ userId, leadId }: PresenceInput): string {
  return `whatsapp:presence:${userId}:${leadId}`;
}

function isPresence(value: unknown): value is LeadPresence {
  return (
    value === "typing" ||
    value === "paused" ||
    value === "online" ||
    value === "offline"
  );
}

export async function setLeadPresence({
  userId,
  leadId,
  presence,
  now = new Date(),
}: PresenceInput & {
  presence: LeadPresence;
  now?: Date;
}): Promise<LeadPresenceSnapshot> {
  const snapshot: LeadPresenceSnapshot = {
    presence,
    lastSeen: now.toISOString(),
  };
  await getRedis().set(
    presenceKey({ userId, leadId }),
    JSON.stringify(snapshot),
    "EX",
    WHATSAPP_PRESENCE_TTL_SECONDS,
  );
  return snapshot;
}

export async function getLeadPresence(
  input: PresenceInput,
): Promise<LeadPresenceSnapshot> {
  const raw = await getRedis().get(presenceKey(input));
  if (!raw) return { presence: "offline", lastSeen: null };

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!isPresence(parsed.presence)) {
      return { presence: "offline", lastSeen: null };
    }
    return {
      presence: parsed.presence,
      lastSeen: typeof parsed.lastSeen === "string" ? parsed.lastSeen : null,
    };
  } catch {
    return { presence: "offline", lastSeen: null };
  }
}
