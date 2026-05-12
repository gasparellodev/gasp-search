"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { WhatsappIcon } from "@/components/sites/social-icons";
import { trackEvent } from "@/lib/analytics/track-event";
import { useFloatingCtaVisibility } from "@/lib/hooks/use-floating-cta-visibility";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import type { SiteVariablesV2 } from "@/types/lead-site";

type WhatsAppFloatingVariables = Pick<
  SiteVariablesV2,
  "business_name" | "whatsapp"
>;

interface WhatsAppFloatingCTAProps {
  variables: WhatsAppFloatingVariables;
  slug: string;
}

export function WhatsAppFloatingCTA({
  variables,
  slug,
}: WhatsAppFloatingCTAProps) {
  const isVisible = useFloatingCtaVisibility();
  const pathname = usePathname();
  const isCarDetailPath =
    pathname?.startsWith(`/sites/${slug}/estoque/`) === true;
  const whatsappHref = useMemo(
    () =>
      buildWhatsAppLink({
        template: "general",
        phone: variables.whatsapp,
        businessName: variables.business_name,
        siteSlug: slug,
        component: "floating-cta",
      }),
    [slug, variables.business_name, variables.whatsapp],
  );

  if (!isVisible) return null;

  return (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        trackEvent("whatsapp_click", { component: "floating-cta" });
      }}
      aria-label="Contato WhatsApp"
      title="Contato WhatsApp"
      data-testid="whatsapp-floating-cta"
      className={cn(
        "fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[var(--z-floating-cta,50)] inline-flex size-14 items-center justify-center rounded-[var(--auto-radius-full,9999px)] bg-[var(--auto-whatsapp,#25d366)] text-white shadow-[var(--auto-shadow-whatsapp-floating)] transition-transform duration-[var(--auto-duration-base,250ms)] ease-[var(--auto-ease-out,cubic-bezier(0.16,1,0.3,1))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-whatsapp,#25d366)] focus-visible:ring-offset-2 md:size-[60px] motion-safe:hover:scale-105",
        isCarDetailPath &&
          "bottom-[calc(5.75rem+env(safe-area-inset-bottom))] md:bottom-[calc(1rem+env(safe-area-inset-bottom))]",
      )}
    >
      <WhatsappIcon className="size-7" aria-hidden />
    </a>
  );
}
