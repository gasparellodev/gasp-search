export const CONSENT_STORAGE_KEY = "gasp_consent_v1";
export const CONSENT_VERSION = "v1";
export const CONSENT_CHANGE_EVENT = "gasp-consent-change";

export type ConsentCategory = "analytics" | "marketing";
export type ConsentAction = "accept_all" | "accept_selected" | "reject";

export interface ConsentCategories {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
}

export interface ConsentDecision {
  version: typeof CONSENT_VERSION;
  action: ConsentAction;
  categories: ConsentCategories;
  updatedAt: string;
}

export const COOKIE_CONSENT_TEXT =
  "Usamos cookies para melhorar sua experiência. Você pode aceitar todos ou personalizar.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function parseConsentDecision(raw: string | null): ConsentDecision | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (parsed.version !== CONSENT_VERSION) return null;
    if (
      parsed.action !== "accept_all" &&
      parsed.action !== "accept_selected" &&
      parsed.action !== "reject"
    ) {
      return null;
    }
    if (!isRecord(parsed.categories)) return null;
    const { necessary, analytics, marketing } = parsed.categories;
    if (necessary !== true) return null;
    if (typeof analytics !== "boolean" || typeof marketing !== "boolean") {
      return null;
    }
    if (typeof parsed.updatedAt !== "string") return null;

    return {
      version: CONSENT_VERSION,
      action: parsed.action,
      categories: {
        necessary: true,
        analytics,
        marketing,
      },
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function buildConsentDecision(
  action: ConsentAction,
  categories: Omit<ConsentCategories, "necessary">,
  updatedAt = new Date().toISOString(),
): ConsentDecision {
  return {
    version: CONSENT_VERSION,
    action,
    categories: {
      necessary: true,
      analytics: categories.analytics,
      marketing: categories.marketing,
    },
    updatedAt,
  };
}
