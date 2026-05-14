import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONSENT_STORAGE_KEY,
  buildConsentDecision,
} from "@/lib/lgpd/consent-state";

describe("trackEvent", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    (
      window as unknown as {
        gtag?: (...args: unknown[]) => void;
      }
    ).gtag = vi.fn();
  });

  afterEach(() => {
    localStorage.clear();
    delete (window as unknown as { gtag?: unknown }).gtag;
  });

  it("não chama gtag sem consentimento de analytics", async () => {
    const { trackEvent } = await import("@/lib/analytics/track-event");
    trackEvent("whatsapp_click", { component: "test" });
    expect(window.gtag).not.toHaveBeenCalled();
  });

  it("chama gtag quando analytics está opt-in", async () => {
    const decision = buildConsentDecision("accept_all", {
      analytics: true,
      marketing: false,
    });
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(decision));

    const { trackEvent } = await import("@/lib/analytics/track-event");
    trackEvent("form_submit", { form_variant: "contact" });

    expect(window.gtag).toHaveBeenCalledWith(
      "event",
      "form_submit",
      expect.objectContaining({ form_variant: "contact" }),
    );
  });
});
