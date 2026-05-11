"use client";

import { useSyncExternalStore } from "react";

function isFloatingCtaVisibleSnapshot(): boolean {
  if (typeof document === "undefined") return true;
  return !document.body.hasAttribute("data-modal-open");
}

function subscribeToModalOpen(callback: () => void) {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return () => {};
  }

  const observer = new MutationObserver(callback);
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-modal-open"],
  });

  return () => observer.disconnect();
}

export function useFloatingCtaVisibility(): boolean {
  return useSyncExternalStore(
    subscribeToModalOpen,
    isFloatingCtaVisibleSnapshot,
    () => true,
  );
}
