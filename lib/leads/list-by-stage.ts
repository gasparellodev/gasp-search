import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  LEAD_STAGES,
  type LeadStage,
} from "@/lib/validators/leads";

export interface PipelineCard {
  id: string;
  name: string;
  stage: LeadStage;
  score: number;
  category: string | null;
  city: string | null;
  state: string | null;
}

export type PipelineBoard = Record<LeadStage, PipelineCard[]>;

const PIPELINE_SELECT =
  "id, name, stage, score, category, city, state";

export async function listLeadsByStage({
  supabase,
}: {
  supabase: SupabaseClient<Database>;
}): Promise<PipelineBoard> {
  const { data, error } = await supabase
    .from("leads")
    .select(PIPELINE_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Falha ao montar pipeline: ${error.message}`);
  }

  const board: PipelineBoard = LEAD_STAGES.reduce<PipelineBoard>(
    (acc, stage) => {
      acc[stage] = [];
      return acc;
    },
    {} as PipelineBoard,
  );

  for (const row of (data ?? []) as PipelineCard[]) {
    if ((LEAD_STAGES as readonly string[]).includes(row.stage)) {
      board[row.stage].push(row);
    }
  }

  return board;
}
