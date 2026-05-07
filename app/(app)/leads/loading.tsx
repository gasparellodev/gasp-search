import { Skeleton } from "@/components/ui/skeleton";

export default function LeadsLoading() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-6" aria-label="Carregando leads">
      <div className="shrink-0 space-y-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="border-border bg-card grid shrink-0 gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_140px_140px_140px_180px_auto]">
        <Skeleton className="h-9 sm:col-span-2 lg:col-span-1" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>

      <div className="border-border min-h-0 flex-1 space-y-3 rounded-lg border p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
