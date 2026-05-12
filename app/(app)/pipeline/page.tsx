import { PipelineBoard } from "@/components/pipeline/board";
import { listLeadsByStage } from "@/lib/leads/list-by-stage";
import { listTags } from "@/lib/leads/list-tags";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = await createServerSupabase();
  const [board, tags] = await Promise.all([
    listLeadsByStage({ supabase }),
    listTags({ supabase }),
  ]);

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] min-h-0 min-w-0 flex-col gap-6 sm:h-[calc(100dvh-7.5rem)]">
      <div className="shrink-0">
        <h1 className="sk-h1">Pipeline</h1>
        <p className="sk-body-lg text-muted-foreground mt-2">
          Kanban dos seus leads. Arraste o card para mudar o estágio.
        </p>
      </div>

      <PipelineBoard board={board} tags={tags} />
    </div>
  );
}
