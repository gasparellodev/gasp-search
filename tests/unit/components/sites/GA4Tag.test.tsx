import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONSENT_STORAGE_KEY,
  buildConsentDecision,
} from "@/lib/lgpd/consent-state";

vi.mock("@/app/actions/consent-audit", () => ({
  recordConsentDecision: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("next/script", () => ({
  default: ({ id, src }: { id?: string; src?: string }) => (
    // Double de teste para `next/script` (não é injeção real no app).
    // eslint-disable-next-line @next/next/no-sync-scripts -- mock de Script
    <script data-testid={id ?? "inline-script"} src={src} />
  ),
}));

describe("<GA4Tag />", () => {
  beforeEach(() => {
    localStorage.clear();
    process.env.NEXT_PUBLIC_GA4_ID = "G-UNITTEST123";
    vi.resetModules();
  });

  it("não renderiza scripts sem consentimento de analytics", async () => {
    const { GA4Tag } = await import("@/components/sites/GA4Tag");
    render(<GA4Tag />);
    expect(screen.queryByTestId("gasp-ga4-init")).not.toBeInTheDocument();
    expect(
      document.querySelector('script[src*="googletagmanager.com"]'),
    ).toBeNull();
  });

  it("renderiza gtag após Aceitar todos no banner", async () => {
    const user = userEvent.setup();
    const { GA4Tag } = await import("@/components/sites/GA4Tag");
    const { CookieBanner } = await import("@/components/sites/CookieBanner");

    render(
      <>
        <CookieBanner />
        <GA4Tag />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Aceitar todos" }));

    await waitFor(() => {
      expect(
        document.querySelector('script[src*="googletagmanager.com/gtag/js"]'),
      ).toBeTruthy();
    });
  });

  it("renderiza quando localStorage já tem analytics true", async () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify(
        buildConsentDecision("accept_all", {
          analytics: true,
          marketing: false,
        }),
      ),
    );

    const { GA4Tag } = await import("@/components/sites/GA4Tag");
    render(<GA4Tag />);

    await waitFor(() => {
      expect(
        document.querySelector('script[src*="googletagmanager.com/gtag/js"]'),
      ).toBeTruthy();
    });
  });
});
