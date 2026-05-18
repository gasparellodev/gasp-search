/**
 * Tipos compartilhados do front-end da Iara. Não importa `server-only`
 * — pode ser usado em Client Components.
 */

export type IaraApprovalStatus = "pending" | "approved" | "rejected";
export type IaraHandoffPriority = "P0" | "P1" | "P2" | "P3";

export interface IaraToolCallRecord {
  tool: string;
  input: unknown;
  output: unknown;
}

export interface IaraChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls: unknown[] | null;
  createdAt?: string;
}

export interface IaraHandoffEntry {
  priority: IaraHandoffPriority;
  motivo: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface IaraConversationListItem {
  id: string;
  leadId: string;
  leadBusinessName: string;
  leadCity: string | null;
  iaraVersion: string;
  isSandbox: boolean;
  lastMessageAt: string | null;
  messageCount: number;
  handoffCount: number;
  latestHandoffPriority: IaraHandoffPriority | null;
  approvalStatus: IaraApprovalStatus;
  createdAt: string;
}

export interface IaraConversationDetail {
  conversation: {
    id: string;
    leadId: string;
    iaraVersion: string;
    isSandbox: boolean;
    lastMessageAt: string | null;
    approvalStatus: IaraApprovalStatus;
    approvalNotes: string | null;
    reviewedAt: string | null;
    createdAt: string;
  };
  lead: {
    id: string;
    business_name: string;
    city: string | null;
    status: string;
  };
  messages: IaraChatMessage[];
  handoffs: IaraHandoffEntry[];
}

export const HANDOFF_LABEL: Record<IaraHandoffPriority, string> = {
  P0: "P0 — pagamento iminente",
  P1: "P1 — bloqueador crítico",
  P2: "P2 — fila do dia",
  P3: "P3 — informativo",
};

export const HANDOFF_ICON: Record<IaraHandoffPriority, string> = {
  P0: "🔴",
  P1: "🟡",
  P2: "🔵",
  P3: "⚪",
};

export const APPROVAL_LABEL: Record<IaraApprovalStatus, string> = {
  pending: "Aguardando revisão",
  approved: "Aprovada",
  rejected: "Reprovada",
};
