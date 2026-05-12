/**
 * FAQ contextual hardcoded PT-BR para `/sites/<slug>/estoque/<carSlug>`
 * (Phase 7 / Sprint 6 / #D3 — issue #228).
 *
 * Renderizado via `<SiteFAQ>` shared (`components/sites/SiteFAQ.tsx`) que
 * usa Radix Accordion (aria-expanded built-in). **NÃO emite JSON-LD
 * `FAQPage`** — anti-pattern Google p/ business sites desde 2023.
 *
 * Substituições placeholders:
 *  - `{brand}` → `car.brand` (preserva case original).
 *  - `{model}` → `car.model` (preserva case original).
 *  - `{year}` → `car.year` formatado como string.
 *
 * Mudanças aqui são mudança de copy do produto — bater com PO antes de
 * editar.
 *
 * Range AC: 4-6 perguntas. V1 fica em 5 (sweet spot — Radix Accordion
 * fica longo demais com 6+, e Lighthouse penaliza below-the-fold com
 * muitos collapses).
 */

export interface DetailFaqEntry {
  question: string;
  answer: string;
}

export interface DetailFaqCarContext {
  brand: string;
  model: string;
  year: number;
}

/**
 * Templates crus com placeholders `{brand}/{model}/{year}` — não usar
 * direto na UI. Sempre passar por `buildDetailFaqItems(car)`.
 */
export const DETAIL_FAQ_TEMPLATE: readonly DetailFaqEntry[] = [
  {
    question: "Esse {brand} {model} {year} aceita troca?",
    answer:
      "Sim — avaliamos seu carro como entrada sem compromisso. Você pode mandar fotos e dados pelo WhatsApp ou trazer o veículo até a loja. A avaliação fica válida por 7 dias.",
  },
  {
    question: "Qual a garantia oferecida no {brand} {model}?",
    answer:
      "Todos os carros do estoque, incluindo o {model} {year}, saem com garantia mecânica de 3 meses cobrindo motor, câmbio e diferencial. A garantia é da própria loja — sem letras miúdas.",
  },
  {
    question: "Posso financiar esse {model} {year}?",
    answer:
      "Sim. Trabalhamos com os principais bancos parceiros (Bradesco, Itaú, Santander, BV, Pan, Safra e Sicoob), buscando a melhor taxa pra cada perfil. A simulação leva 5 minutos e a aprovação pode sair no mesmo dia.",
  },
  {
    question: "Como funciona a transferência do {brand} {model}?",
    answer:
      "Cuidamos de todo o processo de transferência: DUT, IPVA, multas e taxas. Você recebe o {model} com a documentação 100% no seu nome, sem precisar ir ao Detran.",
  },
  {
    question: "Posso reservar esse veículo antes de visitar a loja?",
    answer:
      "Sim. Mediante sinal e combinação direta com a equipe, reservamos o {model} {year} por até 48h pra você ter tempo de visitar e testar.",
  },
] as const;

/**
 * Substitui placeholders nas templates pelos valores do carro renderizado.
 *
 * Substituição global (`replaceAll`-style) — múltiplas ocorrências do
 * mesmo placeholder na mesma string viram todas substituídas.
 *
 * @param car — subset do `SiteCar` com brand/model/year do carro atual.
 * @returns array novo de `DetailFaqEntry` interpolado (sem mutação).
 */
export function buildDetailFaqItems(
  car: DetailFaqCarContext,
): DetailFaqEntry[] {
  const yearStr = String(car.year);
  const interpolate = (input: string): string =>
    input
      // Ordem importa: substitui o mais específico primeiro pra evitar
      // ambiguidade improvável (e.g. brand chamado "model" — bizarro
      // mas defensivo).
      .split("{brand}").join(car.brand)
      .split("{model}").join(car.model)
      .split("{year}").join(yearStr);

  return DETAIL_FAQ_TEMPLATE.map((entry) => ({
    question: interpolate(entry.question),
    answer: interpolate(entry.answer),
  }));
}
