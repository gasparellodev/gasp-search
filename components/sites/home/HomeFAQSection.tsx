"use client";

import { SiteFAQ } from "@/components/sites/SiteFAQ";
import { FAQ_TEMPLATE } from "@/lib/sites/faq-template";

/**
 * FAQ section — Radix Accordion (Phase 7 / Sprint 4 / #H3 — issue #223).
 *
 * **IMPORTANTE:** sem JSON-LD `FAQPage` Schema (DESIGN.md anti-pattern
 * — Google penaliza FAQPage em business sites desde 2023). Componente
 * é semântico via Radix Accordion apenas.
 *
 * Client Component (Radix usa state interno pra abrir/fechar). Conteúdo
 * vem de `lib/sites/faq-template.ts` (8 perguntas canônicas).
 *
 * A11y: Radix.Accordion já fornece roles/ARIA corretos. `<ChevronDown>`
 * rotaciona via CSS `data-state="open"` selector.
 */
export function HomeFAQSection() {
  return (
    <SiteFAQ
      title="Perguntas frequentes"
      items={FAQ_TEMPLATE}
      testId="home-faq-section"
    />
  );
}
