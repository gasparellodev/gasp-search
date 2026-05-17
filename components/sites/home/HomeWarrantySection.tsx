import "server-only";

import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

import { FALLBACK_IMAGE_URL } from "@/lib/sites/merge";
import { WARRANTY_BULLETS } from "@/lib/sites/warranty-bullets";

interface HomeWarrantySectionProps {
  /** Nome do negócio — usado no `<h2>`. */
  businessName: string;
  /**
   * URL/path da foto editorial vinda do manifest AI (Sprint 2 / #A3).
   * Tem precedência sobre `aboutImageUrl`. Quando null, cai no
   * `aboutImageUrl`; quando esse também é null/empty, usa
   * `FALLBACK_IMAGE_URL` (placeholder genérico).
   */
  manifestAboutUrl: string | null;
  /** URL/path da foto fallback vinda do brand pipeline. */
  aboutImageUrl: string | null | undefined;
}

/**
 * Warranty section da Home V2 (Phase 7 / Sprint 4 / #H3 — issue #223).
 *
 * Split editorial 6/6 desktop (foto esquerda + copy direita); stack
 * mobile. 4 bullets PT-BR canônicos vindos de
 * `lib/sites/warranty-bullets.ts` renderizados com `<CheckCircle2 />`.
 *
 * **Foto fallback chain** (PO decision — manifest v1 NÃO tem
 * `warranty_editorial`):
 *   `manifest?.about_url ?? brand_assets.about_image_url ?? FALLBACK_IMAGE_URL`
 *
 * Server Component. Sem state — bullets são render estático.
 */
export function HomeWarrantySection({
  businessName,
  manifestAboutUrl,
  aboutImageUrl,
}: HomeWarrantySectionProps) {
  const imageUrl =
    manifestAboutUrl ??
    (aboutImageUrl && aboutImageUrl.length > 0
      ? aboutImageUrl
      : FALLBACK_IMAGE_URL);

  return (
    <section
      data-reveal
      data-testid="home-warranty-section"
      aria-label="Garantia e diferenciais"
      className="w-full bg-background py-16 md:py-24"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 md:grid-cols-2 md:gap-16 md:px-8">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-foreground/5">
          <Image
            src={imageUrl}
            alt={`Equipe ${businessName}`}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover object-center"
            unoptimized
          />
        </div>

        <div className="flex flex-col gap-6">
          <h2 className="as-h2 text-foreground">
            Por que comprar com a {businessName}
          </h2>

          <ul className="flex flex-col gap-4" role="list">
            {WARRANTY_BULLETS.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3">
                <CheckCircle2
                  className="mt-0.5 size-6 shrink-0 text-foreground"
                  style={{ color: "var(--site-primary)" }}
                  aria-hidden="true"
                />
                <span className="text-base text-foreground/85 md:text-lg">
                  {bullet}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
