import "server-only";

import { Clock } from "lucide-react";

const FALLBACK_HOURS = "Segunda a Sexta: 09h-18h | Sábado: 09h-13h";

export function splitBusinessHours(hours: string | null): string[] {
  return (hours ?? FALLBACK_HOURS)
    .split(/\n|\|/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

interface BusinessHoursProps {
  hours: string | null;
}

export function BusinessHours({ hours }: BusinessHoursProps) {
  const entries = splitBusinessHours(hours);

  return (
    <section
      data-testid="business-hours"
      aria-labelledby="business-hours-title"
      className="rounded-site-feature border border-foreground/10 bg-background p-6"
    >
      <div className="flex items-center gap-3">
        <Clock className="size-5 text-foreground/65" aria-hidden="true" />
        <h2 id="business-hours-title" className="text-lg font-semibold">
          Horário de atendimento
        </h2>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-foreground/75 md:text-base">
        {entries.map((entry) => (
          <li key={entry}>{entry}</li>
        ))}
      </ul>
    </section>
  );
}
