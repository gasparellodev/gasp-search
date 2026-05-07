import { Skeleton } from "@/components/ui/skeleton";

export default function PipelineLoading() {
  return (
    <div className="flex h-[calc(100dvh-6.5rem)] min-h-0 min-w-0 flex-col gap-6 sm:h-[calc(100dvh-7.5rem)]" aria-label="Carregando pipeline">
      <div className="shrink-0 space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, columnIndex) => (
          <div
            key={columnIndex}
            className="border-border bg-card min-h-0 space-y-3 rounded-lg border p-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-6" />
            </div>
            {Array.from({ length: 4 }).map((_, cardIndex) => (
              <Skeleton key={cardIndex} className="h-24 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
