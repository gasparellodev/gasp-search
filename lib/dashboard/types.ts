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

export type DashboardSummary = {
  totalLeads: number;
  newLeadsLast7Days: number;
  leadsByStage: Record<LeadStage, number>;
  recentSearches: RecentSearch[];
};
