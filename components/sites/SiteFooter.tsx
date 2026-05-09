import Image from "next/image";
import { ArrowRight } from "lucide-react";

import type { SiteVariables } from "@/types/lead-site";

import {
  FacebookIcon,
  InstagramIcon,
  WhatsappIcon,
  YoutubeIcon,
} from "./social-icons";

type FooterVariables = Pick<
  SiteVariables,
  | "business_name"
  | "logo_url"
  | "whatsapp"
  | "phone_display"
  | "email"
  | "instagram_url"
  | "facebook_url"
  | "youtube_url"
  | "address_line"
  | "hours"
  | "primary_color"
>;

interface SiteFooterProps {
  variables: FooterVariables;
}

/**
 * Footer global do site público (Phase 7 — issue #161). Server Component.
 *
 * Layout:
 *   - 3 colunas no desktop: marca + sociais | contato | newsletter.
 *   - Empilhado em mobile.
 *
 * Newsletter input é **visual-only** no MVP (sem `name`, sem submit
 * handler, `onSubmit` previne default). Spec §15 não exige captura de
 * newsletter; quando virar funcional, criar issue follow-up + tabela
 * própria (não confundir com `site_form_submissions`).
 *
 * Ícones sociais são omitidos individualmente quando o URL é `null` —
 * defendendo contra footer com ícones "mortos" para concessionárias que
 * não preencheram alguma rede.
 */
export function SiteFooter({ variables }: SiteFooterProps) {
  const year = new Date().getFullYear();
  const whatsappHref = `https://wa.me/${variables.whatsapp}`;

  return (
    <footer
      data-testid="site-footer"
      className="mt-16 border-t border-foreground/10 bg-background"
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-3 md:gap-8 md:px-8 md:py-16">
        {/* Marca + sociais */}
        <div className="space-y-6">
          <Image
            src={variables.logo_url}
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

        {/* Contato */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">Contato</h2>
          <ul className="space-y-3 text-sm text-foreground/80">
            <li>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 transition hover:text-foreground"
              >
                WhatsApp
              </a>
            </li>
            {variables.email && (
              <li>
                <a
                  href={`mailto:${variables.email}`}
                  className="transition hover:text-foreground"
                >
                  {variables.email}
                </a>
              </li>
            )}
            <li>{variables.phone_display}</li>
            {variables.address_line && (
              <li className="text-foreground/60">{variables.address_line}</li>
            )}
            {variables.hours && (
              <li className="text-foreground/60">{variables.hours}</li>
            )}
          </ul>
        </div>

        {/* Newsletter — VISUAL ONLY no MVP */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">Inscreva-se</h2>
          <p className="text-sm text-foreground/70">
            Informe seu email para receber as últimas novidades da{" "}
            {variables.business_name}.
          </p>
          {/*
            Newsletter visual-only: o form não tem submit handler nem name no
            input. Quando virar funcional, criar issue follow-up com migration
            própria. Não confundir com `site_form_submissions` (lead capture).
          */}
          <form
            data-testid="newsletter-form"
            onSubmit={(e) => e.preventDefault()}
            className="flex items-center gap-2"
          >
            <label htmlFor="newsletter-email" className="sr-only">
              E-mail para newsletter
            </label>
            <input
              id="newsletter-email"
              type="email"
              placeholder="E-mail"
              autoComplete="off"
              disabled
              className="flex-1 rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              disabled
              aria-label="Inscrever (em breve)"
              className="inline-flex size-10 items-center justify-center rounded-md bg-foreground text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowRight className="size-5" aria-hidden />
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-foreground/10">
        <p className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-foreground/60 md:px-8">
          © {year} {variables.business_name}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
