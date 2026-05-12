import type { Tables } from "@/types/database";
import type { LeadSource, LeadStage } from "@/lib/validators/leads";

export type RecentSearch = {
  id: string;
  source: LeadSource;
  status: Tables<"search_jobs">["status"];
  resultsCount: number;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export type SourceBreakdownItem = {
  source: LeadSource;
  total: number;
  closedWon: number;
  conversionRate: number;
};

export const FUNNEL_STAGES = [
  "new",
  "contacted",
  "in_conversation",
  "qualified",
  "closed_won",
] as const satisfies ReadonlyArray<LeadStage>;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export type FunnelStageStat = {
  stage: FunnelStage;
  count: number;
  dropRate: number | null;
};

export type DashboardCounters = {
  totalLeads: number;
  newLeadsLast7Days: number;
  leadsByStage: Record<LeadStage, number>;
  recentSearches: RecentSearch[];
};

export type DashboardSummary = DashboardCounters & {
  sourceBreakdown: SourceBreakdownItem[];
  funnel: FunnelStageStat[];
};
