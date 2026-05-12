"use client";

import { useSyncExternalStore } from "react";

import { WhatsappIcon } from "@/components/sites/social-icons";
import { trackEvent } from "@/lib/analytics/track-event";
import {
  type InitialCarContext,
  useCarContext,
} from "@/lib/hooks/use-car-context";
import { cn } from "@/lib/utils";

interface FloatingInstallmentBarProps {
  slug: string;
  carSlug: string;
  initialContext: InitialCarContext;
}

const DESKTOP_QUERY = "(min-width: 1024px)";

function isDesktopSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia === "undefined") {
    return false;
  }
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function subscribeToDesktopQuery(callback: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia === "undefined") {
    return () => {};
  }

  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function useIsDesktopViewport(): boolean {
  return useSyncExternalStore(subscribeToDesktopQuery, isDesktopSnapshot, () => false);
}

export function FloatingInstallmentBar({
  slug,
  carSlug,
  initialContext,
}: FloatingInstallmentBarProps) {
  const isDesktop = useIsDesktopViewport();
  const carContext = useCarContext(slug, carSlug, initialContext);

  if (isDesktop) return null;

  return (
    <aside
      data-testid="floating-installment-bar"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[var(--z-installment-bar,45)] border-t border-[var(--auto-border,#e5e5e5)] bg-[rgb(255_255_255_/_0.94)] px-4 pt-3 shadow-[0_-12px_30px_-24px_rgb(0_0_0_/_0.35)] backdrop-blur-xl lg:hidden",
      )}
      style={{
        paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase text-[var(--auto-muted-foreground,#737373)]">
            {carContext.vehicleLabel}
          </p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-base font-semibold leading-none text-[var(--auto-foreground,#0a0a0a)]">
              {carContext.priceLabel}
            </p>
            {carContext.installmentLabel && (
              <p className="text-xs font-medium text-[var(--auto-muted-foreground,#737373)]">
                {carContext.installmentLabel}
              </p>
            )}
          </div>
        </div>

        <a
          href={carContext.whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            trackEvent("whatsapp_click", { component: "floating-installment-bar" });
          }}
          aria-label={`Falar no WhatsApp sobre ${carContext.vehicleLabel}`}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--auto-radius-full,9999px)] bg-[var(--auto-whatsapp,#25d366)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--auto-whatsapp-hover,#1fb855)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-whatsapp,#25d366)] focus-visible:ring-offset-2"
        >
          <WhatsappIcon className="size-5" aria-hidden />
          WhatsApp
        </a>
      </div>
    </aside>
  );
}
