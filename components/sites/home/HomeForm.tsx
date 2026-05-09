import "server-only";

import { SiteForm } from "../SiteForm";

interface HomeFormProps {
  /** ID do `lead_sites` row, propagado pra Server Action de submit. */
  siteId: string;
  /** Slug do site, usado no link da Política de Privacidade do form. */
  slug: string;
  /** Cor primária — bg do botão Enviar. */
  primary_color: string;
  /** Cor de texto sobre primário — texto do botão. */
  text_on_primary: string;
}

/**
 * Form de captura na Home (Phase 7 — issue #162).
 *
 * Wrapper Server Component sobre `<SiteForm>` (Client) que injeta o
 * título canônico da Home em PT-BR (per spec §15) e fixa
 * `variant='home'`. `<SiteForm>` cuida do react-hook-form + Zod +
 * Server Action `submitSiteForm`.
 *
 * Decisão V1: título fixo (não parametrizado em `SiteVariables`). V2
 * pode estender o schema se PO precisar variar.
 */
export function HomeForm({
  siteId,
  slug,
  primary_color,
  text_on_primary,
}: HomeFormProps) {
  return (
    <section
      data-testid="home-form"
      className="w-full bg-background py-12 md:py-16"
    >
      <SiteForm
        siteId={siteId}
        slug={slug}
        variant="home"
        primary_color={primary_color}
        text_on_primary={text_on_primary}
        title="Você está procurando algum modelo em específico?"
      />
    </section>
  );
}
