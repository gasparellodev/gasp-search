import "server-only";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";

import { buildWhatsAppLink } from "@/lib/whatsapp";

interface HomeTradeinWidgetProps {
  /**
   * URL pré-resolvida do manifest AI (`manifest.tradein_url`). Caller
   * (`SitePage`) já fez `manifest?.tradein_url ?? null`.
   *
   * **Issue #298 (WP-A):** campo dedicado em `VisualIdentityManifest`,
   * separado de `about_url` que continua sendo consumido por
   * `<HomeWarrantySection>`. Resolve a duplicação visual reportada pelo
   * cliente (mesma foto editorial aparecia em "Seu carro" e "Por que
   * comprar").
   */
  manifestTradeinUrl: string | null;
  /**
   * URL canon do brand asset `brand_assets.tradein_image_url` (#298) —
   * segundo tier do chain de fallback. Optional + nullable porque o
   * campo é novo no schema e ainda não populado por sites legados;
   * widget cai no fallback local quando ausente.
   */
  tradeinImageUrl: string | null | undefined;
  /** Slug do site (link interno `/sites/<slug>/anunciar`). */
  siteSlug: string;
  /** Telefone E.164 BR sem `+`. */
  whatsappPhone: string;
  /** Nome do negócio. */
  businessName: string;
}

/**
 * Default fallback de foto editorial — usado se manifest E about_image_url
 * estiverem ausentes/inválidos. Path em `public/assets/about/`.
 *
 * Em V1 só `porsche-model.png` existe; quando o time anexar o asset
 * "dealership-warm.png" (PO design follow-up), troca aqui.
 */
const FALLBACK_PHOTO = "/assets/about/porsche-model.png";

/**
 * Bloco "Seu carro vale entrada" da Home (Phase 7 / Sprint 4 / #H2 — issue #222;
 * separação Trade-in/About — issue #298).
 *
 * Server Component. Split 6/6 desktop: foto editorial à esquerda, copy + 2 CTAs
 * à direita.
 *
 * **Foto** (#298): chain `manifestTradeinUrl ?? tradeinImageUrl ??
 * FALLBACK_PHOTO`. Não consome `about_url` / `about_image_url` —
 * `<HomeWarrantySection>` continua dono desse slot. Quando os dois primeiros
 * tiers estão null/undefined (legado sem regen + admin não setou o brand
 * asset novo), cai no fallback local que é distinto da imagem de Warranty.
 *
 * **CTAs**:
 *   - Primary: "Avaliar meu carro" → `/sites/<slug>/anunciar` (página de
 *     submit de carro para avaliação).
 *   - Secondary: "WhatsApp" → deep-link template `tradein` (mensagem
 *     pré-fill PT-BR mencionando troca).
 */
export function HomeTradeinWidget({
  manifestTradeinUrl,
  tradeinImageUrl,
  siteSlug,
  whatsappPhone,
  businessName,
}: HomeTradeinWidgetProps) {
  const photoUrl = manifestTradeinUrl ?? tradeinImageUrl ?? FALLBACK_PHOTO;

  // Template `tradein` requer brand/model/year do carro do usuário —
  // não temos ainda. Usamos `general` aqui mas mantemos utm_campaign=tradein
  // via construção manual? Não — buildWhatsAppLink usa o `template` como
  // `utm_campaign`. Para honrar AC ("utm_campaign=tradein"), usamos
  // template `tradein` com placeholders genéricos (ainda dentro do schema).
  const whatsappHref = buildWhatsAppLink({
    phone: whatsappPhone,
    businessName,
    siteSlug,
    component: "home-cta",
    template: "tradein",
    trade: {
      brand: "Marca",
      model: "Modelo",
      year: new Date().getFullYear() - 5,
    },
  });

  return (
    <section
      data-testid="home-tradein-widget"
      className="w-full bg-background"
      aria-labelledby="home-tradein-widget-title"
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center md:gap-12 md:px-8 md:py-16">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-foreground/5 md:aspect-[5/4]">
          <Image
            data-testid="tradein-photo"
            src={photoUrl}
            alt={`Avaliação de carros para troca na ${businessName}`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            unoptimized
          />
        </div>

        <div className="flex flex-col gap-5">
          <h2
            id="home-tradein-widget-title"
            className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
          >
            Seu carro vale entrada
          </h2>
          <p className="max-w-md text-sm text-foreground/70 md:text-base">
            Avaliamos seu veículo na hora — proposta justa baseada na tabela
            FIPE, com pagamento à vista ou crédito da entrada no próximo
            seminovo da {businessName}.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              data-testid="tradein-cta-primary"
              href={`/sites/${siteSlug}/anunciar`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition-colors hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
            >
              Avaliar meu carro
              <ArrowRight aria-hidden className="size-4" />
            </Link>
            <a
              data-testid="tradein-cta-whatsapp"
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--auto-whatsapp,#25d366)] px-5 py-3 text-sm font-semibold text-[var(--auto-whatsapp,#25d366)] transition-colors hover:bg-[var(--auto-whatsapp,#25d366)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-whatsapp,#25d366)]"
            >
              <MessageCircle aria-hidden className="size-4" />
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
