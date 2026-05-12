import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  useConsent,
} from "@/lib/hooks/use-consent";

function persistConsent(categories: { analytics: boolean; marketing: boolean }) {
  window.localStorage.setItem(
    CONSENT_STORAGE_KEY,
    JSON.stringify({
      version: CONSENT_VERSION,
      action: "accept_selected",
      categories: {
        necessary: true,
        ...categories,
      },
      updatedAt: "2026-05-12T00:00:00.000Z",
    }),
  );
}

describe("useConsent()", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("retorna false por padrão para categorias opt-in", () => {
    const { result } = renderHook(() => useConsent("analytics"));

    expect(result.current).toBe(false);
  });

  it("lê consentimento persistido no localStorage", () => {
    persistConsent({ analytics: true, marketing: false });

    const { result } = renderHook(() => useConsent("analytics"));

    expect(result.current).toBe(true);
  });

  it("atualiza reativamente quando a decisão muda no mesmo tab", () => {
    const { result } = renderHook(() => useConsent("marketing"));

    expect(result.current).toBe(false);

    act(() => {
      persistConsent({ analytics: true, marketing: true });
      window.dispatchEvent(new Event("gasp-consent-change"));
    });

    expect(result.current).toBe(true);
  });
});
