import "server-only";

import Image from "next/image";
import { ExternalLink, Mail, MapPin, Phone } from "lucide-react";

import type { SiteVariablesV2 } from "@/types/lead-site";

import { BusinessHours } from "./BusinessHours";
import { WhatsAppDirectCard } from "./WhatsAppDirectCard";

type ContactDualPaneVariables = Pick<
  SiteVariablesV2,
  | "address"
  | "business_name"
  | "business_slug"
  | "email"
  | "hours"
  | "phone_display"
  | "whatsapp"
>;

interface ContactDualPaneProps {
  variables: ContactDualPaneVariables;
  addressLine: string | null;
  staticMapUrl: string | null;
  mapsHref: string;
}

export function ContactDualPane({
  variables,
  addressLine,
  staticMapUrl,
  mapsHref,
}: ContactDualPaneProps) {
  const phoneDigits = variables.phone_display.replace(/\D/g, "");
  const whatsappDigits = variables.whatsapp.replace(/\D/g, "");
  const showPhoneLine =
    phoneDigits.length > 0 &&
    phoneDigits !== whatsappDigits &&
    phoneDigits !== whatsappDigits.replace(/^55/, "");

  return (
    <section className="w-full bg-background py-16 md:py-24">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 md:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)] md:px-8">
        <div className="flex flex-col gap-6">
          <h1
            className="font-bold leading-[1.05] text-foreground"
            style={{ fontSize: "clamp(2.75rem, 6vw, 5rem)" }}
          >
            Contato
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-foreground/70 md:text-lg">
            Fale com a equipe da {variables.business_name} para tirar dúvidas,
            confirmar disponibilidade ou agendar uma visita.
          </p>

          <ul data-testid="contact-channels" className="grid gap-3">
            {showPhoneLine && (
              <li>
                <a
                  href={`tel:+${phoneDigits}`}
                  className="inline-flex items-center gap-3 text-foreground transition hover:text-foreground/75"
                >
                  <Phone className="size-5" aria-hidden="true" />
                  <span>{variables.phone_display}</span>
                </a>
              </li>
            )}
            {variables.email && (
              <li>
                <a
                  href={`mailto:${variables.email}`}
                  className="inline-flex items-center gap-3 text-foreground transition hover:text-foreground/75"
                >
                  <Mail className="size-5" aria-hidden="true" />
                  <span>{variables.email}</span>
                </a>
              </li>
            )}
            {addressLine && (
              <li className="flex items-start gap-3 text-foreground">
                <MapPin className="mt-0.5 size-5 flex-none" aria-hidden="true" />
                <span>{addressLine}</span>
              </li>
            )}
          </ul>

          <div className="grid gap-6 lg:grid-cols-2">
            <BusinessHours hours={variables.hours} />
            <WhatsAppDirectCard
              whatsapp={variables.whatsapp}
              phoneDisplay={variables.phone_display}
              businessName={variables.business_name}
              businessSlug={variables.business_slug}
            />
          </div>
        </div>

        <aside className="overflow-hidden rounded-site-feature border border-foreground/10 bg-foreground/[0.02]">
          <div className="relative aspect-[3/2] w-full bg-foreground/5">
            {staticMapUrl ? (
              <Image
                src={staticMapUrl}
                alt={`Mapa — ${variables.business_name}`}
                fill
                sizes="(min-width: 768px) 42vw, 100vw"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-foreground/70">
                <MapPin className="size-10" aria-hidden="true" />
                <p className="text-sm">
                  Mapa indisponível no momento. Abra a localização no Google
                  Maps.
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-4 p-5">
            <p className="text-sm text-foreground/70">
              {addressLine ?? "Localização da loja"}
            </p>
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-foreground/15 px-3 py-2 text-sm font-medium transition hover:bg-foreground/5"
            >
              Abrir mapa
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </div>
        </aside>
      </div>
    </section>
  );
}
