"use server";

import { headers } from "next/headers";
import { z } from "zod";

import {
  CONSENT_VERSION,
  COOKIE_CONSENT_TEXT,
} from "@/lib/lgpd/consent-state";
import { logConsent } from "@/lib/lgpd/consent-audit";

const ConsentDecisionInputSchema = z.object({
  version: z.literal(CONSENT_VERSION),
  action: z.enum(["accept_all", "accept_selected", "reject"]),
  categories: z.object({
    necessary: z.literal(true),
    analytics: z.boolean(),
    marketing: z.boolean(),
  }),
});

export type RecordConsentDecisionInput = z.infer<
  typeof ConsentDecisionInputSchema
>;

export type RecordConsentDecisionResult = { ok: true } | { ok: false };

export async function recordConsentDecision(
  input: RecordConsentDecisionInput,
): Promise<RecordConsentDecisionResult> {
  const parsed = ConsentDecisionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const hdrs = await headers();
  const result = await logConsent({
    user_id: null,
    ip: resolveClientIp(hdrs),
    user_agent: hdrs.get("user-agent"),
    timestamp: new Date().toISOString(),
    consent_text: COOKIE_CONSENT_TEXT,
    version: parsed.data.version,
    action: parsed.data.action,
    categories: parsed.data.categories,
  });

  return result;
}

function resolveClientIp(hdrs: Headers): string | null {
  const forwardedFor = hdrs.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = hdrs.get("x-real-ip");
  return realIp?.trim() || null;
}
