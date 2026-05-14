"use client";

import Script from "next/script";

import { useConsent } from "@/lib/hooks/use-consent";
import { publicEnv } from "@/lib/env-public";

/**
 * GA4 (consent-gated — issue #233). Só injeta scripts após
 * `useConsent('analytics') === true` e `NEXT_PUBLIC_GA4_ID` definido.
 */
export function GA4Tag() {
  const analyticsOk = useConsent("analytics");
  const measurementId = publicEnv.NEXT_PUBLIC_GA4_ID;

  if (!measurementId || !analyticsOk) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="gasp-ga4-init" strategy="afterInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(measurementId)}, { anonymize_ip: true });
`}
      </Script>
    </>
  );
}
