import "server-only";

import Image from "next/image";
import { Mail, MapPin, Clock, Phone } from "lucide-react";

import type { SiteVariables } from "@/types/lead-site";

import { SiteForm } from "../SiteForm";
import {
  FacebookIcon,
  InstagramIcon,
  WhatsappIcon,
  YoutubeIcon,
} from "../social-icons";

type ContactVariables = Pick<
  SiteVariables,
  | "contact_hero_image_url"
  | "whatsapp"
  | "phone_display"
  | "email"
  | "address_line"
  | "hours"
  | "instagram_url"
  | "facebook_url"
  | "youtube_url"
  | "business_name"
  | "primary_color"
  | "text_on_primary"
>;

interface ContactSectionProps {
  variables: ContactVariables;
  siteId: string;
  slug: string;
}

/**
 * Section principal da rota `/sites/[slug]/contato` (Phase 7 — issue #163).
 *
 * Server Component (`<SiteForm>` internamente é Client). Renderiza:
 *   - Hero com `contact_hero_image_url` + `<h1>` "Contato".
 *   - Lista de canais: WhatsApp (`wa.me/<digits>`), telefone
 *     (`tel:+<digits>`), email (`mailto:` — skip se `null`),
 *     endereço e horário (skip se `null` / fallback "Sob consulta").
 *   - 4 ícones sociais: Instagram, Facebook, YouTube, WhatsApp
 *     (omite individualmente quando o URL é `null`).
 *   - `<SiteForm variant="contact">` no rodapé.
 *
 * Todos os links externos abrem em nova aba com
 * `rel="noopener noreferrer"` (a11y + segurança contra reverse
 * tabnabbing).
 */
export function ContactSection({
  variables,
  siteId,
  slug,
}: ContactSectionProps) {
  const digits = variables.whatsapp.replace(/\D/g, "");
  const whatsappHref = `https://wa.me/${digits}`;
  const telHref = `tel:+${digits}`;

  return (
    <section data-testid="contact-section" className="w-full bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-20">
        {/* Hero */}
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
              <li>
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
              <li>
                <a
                  href={telHref}
                  className="inline-flex items-center gap-3 hover:text-foreground/80"
                >
                  <Phone className="size-5 flex-none" aria-hidden />
                  <span>{variables.phone_display}</span>
                </a>
              </li>
              {variables.email && (
                <li>
                  <a
                    href={`mailto:${variables.email}`}
                    className="inline-flex items-center gap-3 hover:text-foreground/80"
                  >
                    <Mail className="size-5 flex-none" aria-hidden />
                    <span>{variables.email}</span>
                  </a>
                </li>
              )}
              {variables.address_line && (
                <li className="inline-flex items-center gap-3">
                  <MapPin className="size-5 flex-none" aria-hidden />
                  <span>{variables.address_line}</span>
                </li>
              )}
              <li className="inline-flex items-center gap-3">
                <Clock className="size-5 flex-none" aria-hidden />
                <span>{variables.hours ?? "Sob consulta"}</span>
              </li>
            </ul>

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
              <li>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="inline-flex size-10 items-center justify-center rounded-full text-foreground transition hover:bg-foreground/5"
                >
                  <WhatsappIcon className="size-5" />
                </a>
              </li>
            </ul>
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-foreground/5 md:aspect-[5/4]">
            <Image
              src={variables.contact_hero_image_url}
              alt={`Contato — ${variables.business_name}`}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
              unoptimized
            />
          </div>
        </div>

        {/* Form de captura */}
        <div className="mt-16 md:mt-20">
          <SiteForm
            siteId={siteId}
            slug={slug}
            variant="contact"
            primary_color={variables.primary_color}
            text_on_primary={variables.text_on_primary}
          />
        </div>
      </div>
    </section>
  );
}
