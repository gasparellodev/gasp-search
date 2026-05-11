/**
 * 3-step process renderizado em `<HomeProcess3Steps>` (Phase 7 / Sprint 4 /
 * #H3 — issue #223).
 *
 * Conteúdo hardcoded PT-BR canônico definido por PO. Ícones Lucide são
 * referenciados como componentes (`LucideIcon`) — caller renderiza com
 * `<Icon className="..." />`.
 *
 * Mudanças aqui são mudança de copy do produto — bater com PO antes de
 * editar.
 */

import type { LucideIcon } from "lucide-react";
import { FileText, KeyRound, Search } from "lucide-react";

export interface ProcessStep {
  icon: LucideIcon;
  title: string;
  body: string;
}

export const PROCESS_STEPS_TEMPLATE: readonly ProcessStep[] = [
  {
    icon: Search,
    title: "Escolha seu carro",
    body: "Pesquise no nosso estoque atualizado todos os dias com fotos reais e preço fechado.",
  },
  {
    icon: FileText,
    title: "Aprovação simples",
    body: "Simule financiamento em 5 minutos com taxas dos melhores bancos. Sem burocracia.",
  },
  {
    icon: KeyRound,
    title: "Leve pra casa",
    body: "Documentação 100% transferida e garantia mecânica de 3 meses inclusas.",
  },
] as const;
