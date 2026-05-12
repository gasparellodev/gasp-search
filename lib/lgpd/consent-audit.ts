import "server-only";

import { createServiceSupabase } from "@/lib/supabase/service";
import type {
  ConsentAction,
  ConsentCategories,
} from "@/lib/lgpd/consent-state";
import type { Json } from "@/types/database";

export interface LogConsentInput {
  user_id?: string | null;
  ip: string | null;
  user_agent: string | null;
  timestamp: string;
  consent_text: string;
  version: string;
  action: ConsentAction;
  categories: ConsentCategories;
}

export type LogConsentResult = { ok: true } | { ok: false };

export async function logConsent(
  input: LogConsentInput,
): Promise<LogConsentResult> {
  const supabase = createServiceSupabase();
  const result = (await supabase.from("consent_logs").insert({
    user_id: input.user_id ?? null,
    ip: input.ip,
    user_agent: input.user_agent,
    timestamp: input.timestamp,
    consent_text: input.consent_text,
    version: input.version,
    action: input.action,
    categories: input.categories as unknown as Json,
  })) as unknown as { error: { message: string } | null };

  if (result.error) {
    console.warn("logConsent:insert_error", {
      action: input.action,
      version: input.version,
      error_message: result.error.message,
    });
    return { ok: false };
  }

  return { ok: true };
}
