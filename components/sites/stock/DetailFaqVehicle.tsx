import { SiteFAQ } from "@/components/sites/SiteFAQ";
import {
  buildDetailFaqItems,
  type DetailFaqCarContext,
} from "@/lib/sites/detail-faq-templates";

/**
 * FAQ contextual ao veículo no detalhe (Phase 7 / Sprint 6 / #D3 —
 * issue #228).
 *
 * Wrapper fino sobre `<SiteFAQ>` shared + `buildDetailFaqItems`:
 *
 *  - Interpola brand/model/year nos templates PT-BR de
 *    `lib/sites/detail-faq-templates.ts` (5 perguntas).
 *  - Delega render para `<SiteFAQ>` (Radix Accordion shared) — mesmo
 *    visual do FAQ da Home, mantém consistência.
 *  - **NÃO emite JSON-LD `FAQPage`** (anti-pattern Google p/ business
 *    sites).
 *
 * Server Component — `<SiteFAQ>` é client por causa do Radix Accordion;
 * mas o wrapper passa props pré-interpoladas (sem hooks/handlers aqui).
 */
interface DetailFaqVehicleProps {
  car: DetailFaqCarContext;
}

export function DetailFaqVehicle({ car }: DetailFaqVehicleProps) {
  const items = buildDetailFaqItems(car);
  return (
    <SiteFAQ
      title="Perguntas frequentes"
      eyebrow="FAQ DESTE VEÍCULO"
      items={items}
      testId="detail-faq-vehicle"
    />
  );
}
