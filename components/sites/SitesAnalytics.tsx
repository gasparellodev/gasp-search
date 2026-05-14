"use client";

import { Analytics } from "@vercel/analytics/react";

import { GA4Tag } from "@/components/sites/GA4Tag";

/**
 * Analytics dos sites públicos (#233): GA4 (opt-in LGPD) + Vercel Analytics
 * (server-side, sem cookies adicionais do produto).
 */
export function SitesAnalytics() {
  return (
    <>
      <GA4Tag />
      <Analytics />
    </>
  );
}
