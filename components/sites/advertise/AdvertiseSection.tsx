import "server-only";

import { sanitizeHex } from "@/lib/sites/sanitize";

import { AnnounceForm } from "./AnnounceForm";
import { AnnounceHero } from "./AnnounceHero";
import { AnnounceProcessExplanation } from "./AnnounceProcessExplanation";

interface AdvertiseSectionProps {
  siteId: string;
  /** Slug do site, usado no link da Política de Privacidade do form. */
  slug: string;
  primary_color: string;
  text_on_primary: string;
  business_name: string;
  targetCar?: { brand: string; model: string; year: number } | null;
  targetCarSlug?: string | null;
  formSignature?: string | null;
}

/**
 * Section principal da rota `/sites/[slug]/anunciar` (Phase 7 — #163/#231).
 *
 * Server Component que compõe hero editorial, `<AnnounceForm>` (Client)
 * e explicação do processo de avaliação.
 *
 * Cores são sanitizadas via `sanitizeHex` antes de serem propagadas pro
 * Client Component — defesa em profundidade contra CSS injection
 * mesmo que o input venha de fonte externa.
 */
export function AdvertiseSection({
  siteId,
  slug,
  primary_color,
  text_on_primary,
  business_name,
  targetCar = null,
  targetCarSlug = null,
  formSignature = null,
}: AdvertiseSectionProps) {
  const safePrimary = sanitizeHex(primary_color);
  const safeTextOnPrimary = sanitizeHex(text_on_primary);

  return (
    <div data-testid="advertise-section" className="w-full bg-background">
      <AnnounceHero businessName={business_name} targetCar={targetCar} />
      <section className="w-full bg-background pb-16 md:pb-24">
        <div className="mx-auto max-w-5xl px-4 md:px-8">
          <AnnounceForm
            siteId={siteId}
            slug={slug}
            primary_color={safePrimary}
            text_on_primary={safeTextOnPrimary}
            targetCarSlug={targetCarSlug}
            formSignature={formSignature}
          />
        </div>
      </section>
      <AnnounceProcessExplanation />
    </div>
  );
}
