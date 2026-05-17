import "server-only";

import { MessageCircle } from "lucide-react";

import { buildWhatsAppLink } from "@/lib/whatsapp";

interface HomeContactBannerProps {
  /** Telefone WhatsApp do lead (E.164 digits-only). */
  whatsappPhone: string;
  /** Nome do negócio — usado em copy + utm_term. */
  businessName: string;
  /** Slug do site — usado em utm_term. */
  slug: string;
}

/**
 * Banner full-bleed CTA WhatsApp (Wave A5 — D-24).
 *
 * Substitui o `<HomeContactFormQuick>` gigante (409 linhas, dark) da
 * última seção da Home. O form completo segue vivo em `/contato`. Aqui
 * o lead que recebe a demo no WhatsApp não precisa preencher 4 campos
 * pra contatar — ele já tá no WhatsApp.
 *
 * Server Component (sem state). Uma única CTA primary em
 * `var(--site-primary)` com texto curto + ícone MessageCircle.
 */
export function HomeContactBanner({
  whatsappPhone,
  businessName,
  slug,
}: HomeContactBannerProps) {
  const whatsappHref = buildWhatsAppLink({
    template: "general",
    phone: whatsappPhone,
    businessName,
    siteSlug: slug,
    component: "home-cta",
  });

  return (
    <section
      data-reveal
      data-testid="home-contact-banner"
      aria-labelledby="home-contact-banner-title"
      className="w-full bg-foreground/[0.02] py-16 md:py-20"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 text-center md:px-8">
        <h2
          id="home-contact-banner-title"
          className="as-h2 text-foreground"
        >
          Falar agora com a {businessName}
        </h2>
        <p className="max-w-xl text-sm text-foreground/70 md:text-base">
          Tire dúvidas, peça mais fotos, confirme disponibilidade ou
          agende uma visita — atendimento humano no WhatsApp.
        </p>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="home-contact-banner-cta"
          aria-label={`Iniciar conversa no WhatsApp com a ${businessName}`}
          className="as-btn-lift inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--site-primary)] px-7 text-sm font-semibold text-[var(--site-text-on-primary)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-primary)]/60 md:text-base"
        >
          <MessageCircle aria-hidden className="size-5" />
          Falar no WhatsApp
        </a>
      </div>
    </section>
  );
}
