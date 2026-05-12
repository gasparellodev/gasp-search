import type { LeadStage } from "@/lib/validators/leads";

/**
 * Mapas de apresentação canônicos para cada `LeadStage`.
 *
 * Fonte única de verdade — antes desta refatoração existiam 5 cópias do
 * `STAGE_LABEL` espalhadas pela UI (issue #135). Toda surface (tabela,
 * pipeline board, drawer, dashboard, filtros, página de detalhe) deve
 * importar daqui, nunca redefinir localmente.
 *
 * Este módulo é **client-safe**: não toca em segredos nem em
 * `service_role`. Pode ser importado por Client Components diretamente
 * — por isso não tem `import "server-only"` (em contraste com o resto
 * de `lib/leads/`, que é server-only por convenção).
 */

export const STAGE_LABEL: Record<LeadStage, string> = {
  new: "Novo",
  contacted: "Contatado",
  in_conversation: "Em conversa",
  qualified: "Qualificado",
  closed_won: "Ganho",
  closed_lost: "Perdido",
};

export type StageBadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "destructive";

export const STAGE_VARIANT: Record<LeadStage, StageBadgeVariant> = {
  new: "secondary",
  contacted: "outline",
  in_conversation: "outline",
  qualified: "default",
  closed_won: "default",
  closed_lost: "destructive",
};

export const STAGE_ACCENT: Record<LeadStage, string> = {
  new: "border-l-sky-400",
  contacted: "border-l-amber-400",
  in_conversation: "border-l-violet-400",
  qualified: "border-l-emerald-400",
  closed_won: "border-l-emerald-600",
  closed_lost: "border-l-rose-500",
};
