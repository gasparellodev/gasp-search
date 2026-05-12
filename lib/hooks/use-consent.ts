"use client";

import { useMemo, useSyncExternalStore } from "react";

import {
  CONSENT_CHANGE_EVENT,
  CONSENT_STORAGE_KEY,
  type ConsentCategory,
  parseConsentDecision,
} from "@/lib/lgpd/consent-state";

export {
  CONSENT_CHANGE_EVENT,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  type ConsentCategory,
} from "@/lib/lgpd/consent-state";

function readRawDecision() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CONSENT_STORAGE_KEY);
}

function readDecision() {
  if (typeof window === "undefined") return null;
  return parseConsentDecision(window.localStorage.getItem(CONSENT_STORAGE_KEY));
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CONSENT_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CONSENT_CHANGE_EVENT, callback);
  };
}

export function useConsent(category: ConsentCategory): boolean {
  return useSyncExternalStore(
    subscribe,
    () => readDecision()?.categories[category] ?? false,
    () => false,
  );
}

export function useConsentDecision() {
  const raw = useSyncExternalStore(
    subscribe,
    readRawDecision,
    () => null,
  );
  return useMemo(() => parseConsentDecision(raw), [raw]);
}
