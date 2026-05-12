import "server-only";

import { MessageCircle } from "lucide-react";

import { buildWhatsAppLink } from "@/lib/whatsapp";

import { WhatsappIcon } from "../social-icons";

interface WhatsAppDirectCardProps {
  whatsapp: string;
  phoneDisplay: string;
  businessName: string;
  businessSlug: string;
}

export function WhatsAppDirectCard({
  whatsapp,
  phoneDisplay,
  businessName,
  businessSlug,
}: WhatsAppDirectCardProps) {
  const href = buildWhatsAppLink({
    template: "general",
    phone: whatsapp,
    businessName,
    siteSlug: businessSlug,
    component: "contact-section",
  });

  return (
    <article
      data-testid="whatsapp-direct-card"
      className="rounded-site-feature bg-foreground p-6 text-background"
    >
      <div className="flex items-center gap-3">
        <MessageCircle className="size-5" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Atendimento direto</h2>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-background/75 md:text-base">
        Tire dúvidas sobre estoque, financiamento e avaliação de troca pelo
        WhatsApp oficial da loja.
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-background/90"
      >
        <WhatsappIcon className="size-5" aria-hidden="true" />
        <span>Chamar no WhatsApp</span>
        <span className="text-foreground/55">{phoneDisplay}</span>
      </a>
    </article>
  );
}
