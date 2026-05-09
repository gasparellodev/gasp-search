import "server-only";

import { sanitizeHex } from "@/lib/sites/sanitize";

import { AnnounceForm } from "./AnnounceForm";

interface AdvertiseSectionProps {
  siteId: string;
  /** Slug do site, usado no link da Política de Privacidade do form. */
  slug: string;
  primary_color: string;
  text_on_primary: string;
  business_name: string;
}

/**
 * Section principal da rota `/sites/[slug]/anunciar` (Phase 7 — issue #163).
 *
 * Server Component que envolve o `<AnnounceForm>` (Client). Renderiza:
 *   - Header com `<h1>` "Anuncie seu carro aqui" + parágrafo explicativo.
 *   - `<AnnounceForm>` (react-hook-form + Zod + Server Action stub).
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
}: AdvertiseSectionProps) {
  const safePrimary = sanitizeHex(primary_color);
  const safeTextOnPrimary = sanitizeHex(text_on_primary);

  return (
    <section data-testid="advertise-section" className="w-full bg-background">
      <div className="mx-auto max-w-5xl px-4 py-12 md:px-8 md:py-20">
        <div className="flex flex-col gap-6">
          <h1
            className="font-bold leading-[1.05] tracking-tight text-foreground"
            style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)" }}
          >
            Anuncie seu carro aqui
          </h1>
          <p className="text-base text-foreground/70 md:text-lg">
            Conte para a equipe da {business_name} sobre o seu veículo. Vamos
            avaliar e retornar o contato com a melhor proposta.
          </p>
        </div>

        <div className="mt-10 md:mt-12">
          <AnnounceForm
            siteId={siteId}
            slug={slug}
            primary_color={safePrimary}
            text_on_primary={safeTextOnPrimary}
          />
        </div>
      </div>
    </section>
  );
}
