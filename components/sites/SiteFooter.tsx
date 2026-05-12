import Image from "next/image";
import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { buildWhatsAppLink } from "@/lib/whatsapp";
import type { SiteVariablesV2 } from "@/types/lead-site";

import { BanksStrip } from "./BanksStrip";
import { PaymentStrip } from "./PaymentStrip";
import {
  FacebookIcon,
  InstagramIcon,
  WhatsappIcon,
  YoutubeIcon,
} from "./social-icons";

type FooterVariables = Pick<
  SiteVariablesV2,
  | "business_name"
  | "business_slug"
  | "brand_assets"
  | "whatsapp"
  | "phone_display"
  | "email"
  | "instagram_url"
  | "facebook_url"
  | "youtube_url"
  | "address"
  | "hours"
>;

interface SiteFooterProps {
  variables: FooterVariables;
}

const FALLBACK_HOURS = "Segunda a Sexta: 09h-18h | Sábado: 09h-13h";

/**
 * Renderiza o `Address` v2 nested como linha humana para o footer.
 * Retorna `null` se address é null (lead sem endereço estruturado).
 */
function formatAddressLine(
  address: SiteVariablesV2["address"],
): string | null {
  if (!address) return null;
  return `${address.street}, ${address.number} - ${address.neighborhood}, ${address.city} - ${address.state}, ${address.zip}`;
}

/**
 * Footer global do site público (Phase 7 — issue #161, v2 em #206, G2 em #219).
 *
 * Layout:
 *   - 4 colunas no desktop: marca | contato/NAP | horários | navegação.
 *   - Empilhado em mobile.
 *
 * **v2 (#206):** consome `brand_assets` nested + `address` estruturado.
 * **G2 (#219):** adiciona NAP semântico, banks strip, payment methods e
 * microbranding GaspLab.
 *
 * Ícones sociais omitidos individualmente quando o URL é `null`.
 */
export function SiteFooter({ variables }: SiteFooterProps) {
  const year = new Date().getFullYear();
  const { brand_assets } = variables;
  const whatsappHref = buildWhatsAppLink({
    template: "general",
    phone: variables.whatsapp,
    businessName: variables.business_name,
    siteSlug: variables.business_slug,
    component: "footer",
  });
  const addressLine = formatAddressLine(variables.address);
  const hours = variables.hours ?? FALLBACK_HOURS;

  return (
    <footer
      data-testid="site-footer"
      className="mt-16 border-t border-foreground/10 bg-background"
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-4 md:gap-0 md:px-8 md:py-16">
        {/* Marca + sociais */}
        <div className="space-y-6 md:pr-8">
          <Image
            src={brand_assets.logo_url}
            alt={variables.business_name}
            width={140}
            height={40}
            className="h-10 w-auto object-contain"
            unoptimized
          />
          <p className="text-sm text-foreground/70">
            Qualidade, Segurança, Transparência.
          </p>
          <ul className="flex items-center gap-5">
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

        {/* NAP */}
        <div className="space-y-4 md:border-l md:border-foreground/10 md:px-8">
          <h2 className="text-base font-semibold text-foreground">Contato</h2>
          <address
            data-testid="site-footer-address"
            className="space-y-3 text-sm not-italic text-foreground/80"
          >
            <p className="font-medium text-foreground">{variables.business_name}</p>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 transition hover:text-foreground"
            >
              <Phone className="size-4" aria-hidden />
              WhatsApp
            </a>
            <p>{variables.phone_display}</p>
            {variables.email && (
              <p>
                <a
                  href={`mailto:${variables.email}`}
                  className="inline-flex items-center gap-2 transition hover:text-foreground"
                >
                  <Mail className="size-4" aria-hidden />
                  {variables.email}
                </a>
              </p>
            )}
            {addressLine && (
              <p className="flex items-start gap-2 text-foreground/60">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{addressLine}</span>
              </p>
            )}
          </address>
        </div>

        {/* Horários */}
        <div className="space-y-4 md:border-l md:border-foreground/10 md:px-8">
          <h2 className="text-base font-semibold text-foreground">Horários</h2>
          <p className="flex items-start gap-2 text-sm text-foreground/70">
            <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{hours}</span>
          </p>
        </div>

        {/* Navegação */}
        <div className="space-y-4 md:border-l md:border-foreground/10 md:pl-8">
          <h2 className="text-base font-semibold text-foreground">Navegação</h2>
          <nav aria-label="Links do rodapé">
            <ul className="space-y-3 text-sm text-foreground/75">
              <li>
                <Link
                  href={`/sites/${variables.business_slug}`}
                  className="transition hover:text-foreground"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href={`/sites/${variables.business_slug}/estoque`}
                  className="transition hover:text-foreground"
                >
                  Estoque
                </Link>
              </li>
              <li>
                <Link
                  href={`/sites/${variables.business_slug}/sobre`}
                  className="transition hover:text-foreground"
                >
                  Sobre
                </Link>
              </li>
              <li>
                <Link
                  href={`/sites/${variables.business_slug}/contato`}
                  className="transition hover:text-foreground"
                >
                  Contato
                </Link>
              </li>
              <li>
                <Link
                  href={`/sites/${variables.business_slug}/lgpd`}
                  className="transition hover:text-foreground"
                >
                  Política de privacidade LGPD
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      <BanksStrip />
      <PaymentStrip />

      <div className="border-t border-foreground/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-center text-sm text-foreground/60 md:flex-row md:px-8 md:text-left">
          <p>
            © {year} {variables.business_name}. Todos os direitos reservados.
          </p>
          <a
            href="https://gasplab.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground/70 transition hover:text-foreground"
          >
            Site por GaspLab
          </a>
        </div>
      </div>
    </footer>
  );
}
