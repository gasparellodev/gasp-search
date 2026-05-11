import "server-only";

import Image from "next/image";
import { Mail, MapPin, Clock, Phone } from "lucide-react";

import { buildWhatsAppLink } from "@/lib/whatsapp";
import type { SiteVariablesV2 } from "@/types/lead-site";

import { SiteForm } from "../SiteForm";
import {
  FacebookIcon,
  InstagramIcon,
  WhatsappIcon,
  YoutubeIcon,
} from "../social-icons";

type ContactVariables = Pick<
  SiteVariablesV2,
  | "brand_assets"
  | "whatsapp"
  | "phone_display"
  | "email"
  | "address"
  | "hours"
  | "instagram_url"
  | "facebook_url"
  | "youtube_url"
  | "business_name"
  | "business_slug"
>;

interface ContactSectionProps {
  variables: ContactVariables;
  siteId: string;
  slug: string;
  /**
   * URL override do banner Contato (Sprint 2 / #A3 / issue #217). Quando
   * presente, tem precedência sobre `variables.brand_assets.contact_image_url`.
   * O caller (`app/sites/[slug]/contato/page.tsx`) deriva via
   * `manifest?.contact_url ?? variables.brand_assets.contact_image_url`,
   * mantendo este componente thin (uma única fonte de URL).
   */
  manifestContactUrl?: string | null;
}

function formatAddressLine(
  address: SiteVariablesV2["address"],
): string | null {
  if (!address) return null;
  return `${address.street}, ${address.number} — ${address.neighborhood}, ${address.city} - ${address.state}, ${address.zip}`;
}

/**
 * Section principal da rota `/sites/[slug]/contato` (Phase 7 — issue #163, v2 em #206).
 *
 * **v2 (#206):** `contact_hero_image_url` → `brand_assets.contact_image_url`,
 * `address_line` → `address` nested, primary/text_on_primary → `brand_assets.X`.
 */
export function ContactSection({
  variables,
  siteId,
  slug,
  manifestContactUrl,
}: ContactSectionProps) {
  const { brand_assets } = variables;
  const digits = variables.whatsapp.replace(/\D/g, "");
  const whatsappHref = buildWhatsAppLink({
    template: "general",
    phone: variables.whatsapp,
    businessName: variables.business_name,
    siteSlug: variables.business_slug,
    component: "contact-section",
  });
  const phoneDigits = variables.phone_display.replace(/\D/g, "");
  const showPhoneLine =
    phoneDigits.length > 0 &&
    phoneDigits !== digits.replace(/^55/, "") &&
    phoneDigits !== digits;
  const telHref = `tel:+${digits}`;
  const addressLine = formatAddressLine(variables.address);
  // #217 — manifest override tem precedência; fallback pro brand_assets v2.
  const contactImageUrl =
    manifestContactUrl ?? brand_assets.contact_image_url;

  return (
    <section data-testid="contact-section" className="w-full bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-20">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-12 lg:gap-16">
          <div className="flex flex-col gap-6">
            <h1
              className="font-bold leading-[1.05] tracking-tight text-foreground"
              style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)" }}
            >
              Contato
            </h1>
            <p className="text-base text-foreground/70 md:text-lg">
              Fale com a equipe da {variables.business_name} pelo canal que
              preferir.
            </p>

            <ul
              data-testid="contact-channels"
              className="space-y-3 text-base text-foreground md:text-lg"
            >
              <li className="flex">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 hover:text-foreground/80"
                >
                  <WhatsappIcon className="size-5 flex-none" aria-hidden />
                  <span>WhatsApp — {variables.phone_display}</span>
                </a>
              </li>
              {showPhoneLine && (
                <li className="flex">
                  <a
                    href={telHref}
                    className="inline-flex items-center gap-3 hover:text-foreground/80"
                  >
                    <Phone className="size-5 flex-none" aria-hidden />
                    <span>{variables.phone_display}</span>
                  </a>
                </li>
              )}
              {variables.email && (
                <li className="flex">
                  <a
                    href={`mailto:${variables.email}`}
                    className="inline-flex items-center gap-3 hover:text-foreground/80"
                  >
                    <Mail className="size-5 flex-none" aria-hidden />
                    <span>{variables.email}</span>
                  </a>
                </li>
              )}
              {addressLine && (
                <li className="flex items-center gap-3">
                  <MapPin className="size-5 flex-none" aria-hidden />
                  <span>{addressLine}</span>
                </li>
              )}
              <li className="flex items-center gap-3">
                <Clock className="size-5 flex-none" aria-hidden />
                <span>{variables.hours ?? "Sob consulta"}</span>
              </li>
            </ul>

            {(variables.instagram_url ||
              variables.facebook_url ||
              variables.youtube_url) && (
              <ul
                data-testid="contact-socials"
                className="mt-2 flex items-center gap-4"
              >
                {variables.instagram_url && (
                  <li>
                    <a
                      href={variables.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram"
                      className="inline-flex size-10 items-center justify-center rounded-full text-foreground transition hover:bg-foreground/5"
                    >
                      <InstagramIcon className="size-5" />
                    </a>
                  </li>
                )}
                {variables.facebook_url && (
                  <li>
                    <a
                      href={variables.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Facebook"
                      className="inline-flex size-10 items-center justify-center rounded-full text-foreground transition hover:bg-foreground/5"
                    >
                      <FacebookIcon className="size-5" />
                    </a>
                  </li>
                )}
                {variables.youtube_url && (
                  <li>
                    <a
                      href={variables.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="YouTube"
                      className="inline-flex size-10 items-center justify-center rounded-full text-foreground transition hover:bg-foreground/5"
                    >
                      <YoutubeIcon className="size-5" />
                    </a>
                  </li>
                )}
              </ul>
            )}
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-foreground/5 md:aspect-[5/4]">
            <Image
              src={contactImageUrl}
              alt={`Contato — ${variables.business_name}`}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
              unoptimized
            />
          </div>
        </div>

        <div className="mt-16 md:mt-20">
          <SiteForm
            siteId={siteId}
            slug={slug}
            variant="contact"
            primary_color={brand_assets.primary_color}
            text_on_primary={brand_assets.text_on_primary}
          />
        </div>
      </div>
    </section>
  );
}
