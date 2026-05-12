/**
 * Processo de garantia renderizado no deep-dive da página Sobre (#229).
 *
 * Canon dedicado da rota `/sobre`: não reutilizar `WARRANTY_BULLETS`,
 * que são bullets curtos da Home. Mudanças aqui alteram copy de produto
 * e devem passar por aprovação de PO.
 */
export const WARRANTY_PROCESS = [
  {
    icon: "Search",
    title: "Vistoria 100 pontos",
    body: "Cada veículo passa por uma checagem criteriosa de mecânica, elétrica, estrutura e documentação antes de entrar no estoque.",
  },
  {
    icon: "ShieldCheck",
    title: "Garantia mecânica de 3 meses",
    body: "A compra inclui garantia mecânica de 3 meses, com orientação clara sobre cobertura, prazos e canais de atendimento.",
  },
  {
    icon: "Headphones",
    title: "Suporte pós-venda direto",
    body: "Depois da entrega, a equipe acompanha dúvidas de documentação, transferência e uso do veículo sem terceirizar o relacionamento.",
  },
] as const;

export type WarrantyProcessIcon = (typeof WARRANTY_PROCESS)[number]["icon"];
