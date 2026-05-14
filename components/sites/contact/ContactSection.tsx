import "server-only";

import type { SiteVariablesV2 } from "@/types/lead-site";

import { SiteForm } from "../SiteForm";
import {
  FacebookIcon,
  InstagramIcon,
  YoutubeIcon,
} from "../social-icons";

import { ContactDualPane } from "./ContactDualPane";

type ContactVariables = Pick<
  SiteVariablesV2,
  | "address"
  | "brand_assets"
  | "business_name"
  | "business_slug"
  | "email"
  | "facebook_url"
  | "hours"
  | "instagram_url"
  | "phone_display"
  | "whatsapp"
  | "youtube_url"
>;

interface ContactSectionProps {
  variables: ContactVariables;
  siteId: string;
  slug: string;
  staticMapUrl?: string | null;
  mapsHref: string;
}

export function formatAddressLine(
  address: SiteVariablesV2["address"],
): string | null {
  if (!address) return null;
  return `${address.street}, ${address.number} - ${address.neighborhood}, ${address.city} - ${address.state}, ${address.zip}`;
}

export function ContactSection({
  variables,
  siteId,
  slug,
  staticMapUrl = null,
  mapsHref,
}: ContactSectionProps) {
  const { brand_assets } = variables;
  const addressLine = formatAddressLine(variables.address);
  const socials = [
    {
      href: variables.instagram_url,
      label: "Instagram",
      Icon: InstagramIcon,
    },
    {
      href: variables.facebook_url,
      label: "Facebook",
      Icon: FacebookIcon,
    },
    {
      href: variables.youtube_url,
      label: "YouTube",
      Icon: YoutubeIcon,
    },
  ].filter((item): item is { href: string; label: string; Icon: typeof InstagramIcon } =>
    Boolean(item.href),
  );

  return (
    <div data-testid="contact-section" className="w-full bg-background">
      <ContactDualPane
        variables={variables}
        addressLine={addressLine}
        staticMapUrl={staticMapUrl}
        mapsHref={mapsHref}
      />

      {socials.length > 0 && (
        <section className="w-full bg-foreground/[0.02] py-12">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 md:px-8">
            <h2 className="text-lg font-semibold text-foreground">
              Acompanhe a loja
            </h2>
            <ul data-testid="contact-socials" className="flex items-center gap-4">
              {socials.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="inline-flex size-10 items-center justify-center rounded-full text-foreground transition hover:bg-foreground/5"
                  >
                    <Icon className="size-5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="w-full bg-background py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <SiteForm
            siteId={siteId}
            slug={slug}
            variant="contact"
            primary_color={brand_assets.primary_color}
            text_on_primary={brand_assets.text_on_primary}
          />
        </div>
      </section>
    </div>
  );
}
