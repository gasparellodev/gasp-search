import { PipelineBoard } from "@/components/pipeline/board";
import { listLeadsByStage } from "@/lib/leads/list-by-stage";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = await createServerSupabase();
  const board = await listLeadsByStage({ supabase });

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] min-h-0 min-w-0 flex-col gap-6 sm:h-[calc(100dvh-7.5rem)]">
      <div className="shrink-0">
        <h1 className="text-3xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Kanban dos seus leads. Arraste o card para mudar o estágio.
        </p>
      </div>

      <PipelineBoard board={board} />
    </div>
  );
}
