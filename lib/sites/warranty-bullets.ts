/**
 * Hardcoded PT-BR warranty bullets renderizados em `<HomeWarrantySection>`
 * (Phase 7 / Sprint 4 / #H3 — issue #223).
 *
 * 4 bullets canônicos definidos por PO (single source of truth). Cada
 * bullet acompanhado por ícone `<CheckCircle2 />` (Lucide) no componente.
 *
 * Mudanças nesta lista são mudança de copy do produto — bater com PO
 * antes de editar. Não usar em outro contexto (sobre/contato/anunciar)
 * sem alinhamento — esses surfaces têm próprio copywriting.
 */

export const WARRANTY_BULLETS: readonly string[] = [
  "Garantia mecânica de 3 meses inclusa em todos os veículos",
  "Vistoria 100 pontos antes da entrega",
  "Documentação 100% transferida (DUT, IPVA, multas)",
  "Suporte pós-venda direto com a loja",
] as const;
