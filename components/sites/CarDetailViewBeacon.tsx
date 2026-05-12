"use client";

import { useEffect, useRef } from "react";

import { trackEvent } from "@/lib/analytics/track-event";

interface CarDetailViewBeaconProps {
  slug: string;
  carSlug: string;
}

/**
 * Dispara `car_detail_view` uma vez por montagem (issue #233).
 */
export function CarDetailViewBeacon({ slug, carSlug }: CarDetailViewBeaconProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEvent("car_detail_view", { site_slug: slug, car_slug: carSlug });
  }, [slug, carSlug]);

  return null;
}
