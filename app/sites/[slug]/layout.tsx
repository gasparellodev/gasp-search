import "server-only";

import type { ReactNode } from "react";

/**
 * Auto Showroom layout (issue #198 / #F1 Sprint 0).
 *
 * Wrapper das rotas `/sites/[slug]/*` que aplica `data-theme="auto-showroom"`
 * para ativar os tokens premium do DESIGN.md (`globals.css` §Auto Showroom).
 *
 * **Por que data-attribute em vez de classe?** Permite seletor scoped sem
 * conflitar com o `next-themes` que já usa `class` para light/dark. O
 * `[data-theme="auto-showroom"].dark` combina os dois — dark mode do
 * template Auto Showroom é independente do dark mode do app interno.
 *
 * **Per-client theming runtime (V1, fallback hardcoded):** quando a issue
 * #197 PR-B mergear o helper `readSiteVariablesSafe` + consumer migration,
 * este layout vai injetar `--client-primary` / `--client-on-primary` via
 * inline style do `<body>` lendo de `SiteVariablesV2.brand_assets`. Por
 * enquanto, fallback para `#0a0a0a` / `#fafafa` (DESIGN.md neutral primary).
 *
 * Nota: como `<body>` está no root layout (`app/layout.tsx`), aplicamos o
 * `data-theme` no `<div>` wrapper aqui — Next 16 App Router permite
 * múltiplos layouts compostos. O CSS scoped pega via descendant selector
 * (`[data-theme="auto-showroom"] body { ... }`).
 */
export default function AutoShowroomLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="auto-showroom" className="min-h-dvh">
      {children}
    </div>
  );
}
