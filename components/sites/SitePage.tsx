import "server-only";

import type { CSSProperties } from "react";

import { sanitizeHex } from "@/lib/sites/sanitize";
import type { SiteVariables } from "@/types/lead-site";

interface SitePageProps {
  variables: SiteVariables;
  siteId: string;
  slug: string;
}

/**
 * Wrapper público do site renderizado em `/sites/[slug]` (issue #160).
 *
 * **MVP M2.1 — stub mínimo**. Apenas:
 *   - Injeta as CSS vars `--site-primary` e `--site-text-on-primary`
 *     consumidas por todos os Site Components (header, footer, form,
 *     etc.) — issue #161 e em diante.
 *   - Renderiza `<h1>` com `business_name` para desbloquear o E2E
 *     downstream (#166) que afere o nome do negócio.
 *   - Expõe `data-site-id` no wrapper para pinagem em testes Playwright.
 *
 * A composição real (Hero / Categories / Emphasis / Recent / About /
 * Contact / Stock / CarDetail) entra em M2.3-M2.5 (issues #162-#164).
 * Mantemos a API contratual `{ variables, siteId, slug }` agora pra que
 * o swap de stub para implementação completa não exija mudar o caller
 * em `app/sites/[slug]/page.tsx`.
 *
 * **Defesa em profundidade**: cores hex passam por `sanitizeHex` antes
 * de virarem CSS vars — mesmo que a validação Zod de `SiteVariables`
 * tenha falhado por algum motivo, a string injetada no `style` é
 * sintaticamente válida (#RRGGBB) ou cai no fallback `#0C0C0C`.
 */
export function SitePage({ variables, siteId, slug }: SitePageProps) {
  const primary = sanitizeHex(variables.primary_color);
  const textOnPrimary = sanitizeHex(variables.text_on_primary);

  const cssVars = {
    "--site-primary": primary,
    "--site-text-on-primary": textOnPrimary,
  } as CSSProperties;

  return (
    <div
      className="site-page min-h-dvh bg-background text-foreground"
      data-site-id={siteId}
      data-site-slug={slug}
      style={cssVars}
    >
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight">
          {variables.business_name}
        </h1>
        <p className="mt-4 text-muted-foreground">
          Site em construção — composição completa em M2.3-M2.5 (issues
          #162-#164).
        </p>
      </main>
    </div>
  );
}
