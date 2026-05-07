import { Loader2 } from "lucide-react";

export function SearchProgress() {
  return (
    <div
      className="border-border bg-muted/40 flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="text-primary size-4 animate-spin" />
      <span>Executando Google Maps</span>
    </div>
  );
}
