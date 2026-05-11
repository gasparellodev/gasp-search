/**
 * FAQ hardcoded PT-BR renderizado em `<HomeFAQSection>` (Phase 7 / Sprint 4 /
 * #H3 — issue #223). 8 perguntas frequentes alinhadas com vertical de
 * concessionária seminovos.
 *
 * **Importante:** sem JSON-LD `FAQPage` no componente. Google penaliza
 * `FAQPage` em business sites desde 2023 — anti-pattern documentado no
 * DESIGN.md. O componente renderiza Radix Accordion semântico apenas.
 *
 * Mudanças aqui são mudança de copy do produto — bater com PO antes de
 * editar.
 */

export interface FaqEntry {
  question: string;
  answer: string;
}

export const FAQ_TEMPLATE: readonly FaqEntry[] = [
  {
    question: "Vocês fazem financiamento próprio?",
    answer:
      "Trabalhamos com os principais bancos parceiros (Bradesco, Itaú, Santander, BV, Pan, Safra e Sicoob), buscando a melhor taxa pra cada perfil. A simulação leva 5 minutos e a aprovação pode sair no mesmo dia.",
  },
  {
    question: "Quanto tempo demora pra entregar o carro?",
    answer:
      "Após aprovação do financiamento e assinatura dos documentos, a entrega leva em média de 3 a 5 dias úteis — tempo necessário pra transferência completa da documentação.",
  },
  {
    question: "Posso dar meu carro como entrada na troca?",
    answer:
      "Sim. Avaliamos seu veículo sem compromisso — basta nos enviar fotos e dados pelo WhatsApp ou trazer até a loja. A avaliação fica válida por 7 dias.",
  },
  {
    question: "Qual a garantia oferecida?",
    answer:
      "Todos os veículos saem com garantia mecânica de 3 meses inclusa, cobrindo motor, câmbio e diferencial. A garantia é da própria loja — sem letras miúdas.",
  },
  {
    question: "Os carros passam por vistoria antes da venda?",
    answer:
      "Sim. Aplicamos uma vistoria de 100 pontos antes de cada carro entrar no estoque: mecânica, elétrica, lataria, documentação e histórico do veículo. O laudo fica disponível pra você consultar.",
  },
  {
    question: "Vocês aceitam consórcio ou carta de crédito?",
    answer:
      "Aceitamos cartas de crédito de consórcio contempladas como forma de pagamento. Cartas não contempladas dependem de análise — fale com a nossa equipe.",
  },
  {
    question: "Como funciona a transferência da documentação?",
    answer:
      "Cuidamos de todo o processo de transferência: DUT, IPVA, multas e taxas. Você recebe o carro com a documentação 100% no seu nome, sem precisar ir ao Detran.",
  },
  {
    question: "Posso reservar um carro antes de visitar a loja?",
    answer:
      "Sim. Mediante sinal e mediante combinação direta com a equipe, reservamos o carro por até 48h pra você ter tempo de visitar e testar.",
  },
] as const;
