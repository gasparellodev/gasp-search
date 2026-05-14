"use client";

import {
  CONSENT_STORAGE_KEY,
  parseConsentDecision,
} from "@/lib/lgpd/consent-state";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export type SiteTrackEventName =
  | "whatsapp_click"
  | "form_submit"
  | "phone_click"
  | "tradein_submit"
  | "financing_calc"
  | "car_detail_view";

function isAnalyticsConsentGranted(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  return parseConsentDecision(raw)?.categories.analytics === true;
}

/**
 * Dispara evento GA4 (`gtag`) apenas com consentimento de analytics ativo.
 * No-op em SSR, sem consent ou se `gtag` ainda não carregou.
 */
export function trackEvent(
  name: SiteTrackEventName,
  params?: Record<string, string | number | boolean | undefined>,
): void {
  if (typeof window === "undefined") return;
  if (!isAnalyticsConsentGranted()) return;
  try {
    const payload = Object.fromEntries(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined),
    ) as Record<string, string | number | boolean>;
    window.gtag?.("event", name, payload);
  } catch {
    // best-effort — analytics nunca quebra UX
  }
}
