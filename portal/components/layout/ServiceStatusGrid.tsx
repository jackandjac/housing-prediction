"use client";

import { Badge } from "@/components/ui/Feedback";
import { useServiceStatus } from "@/hooks/useMl";
import type { ServiceStatus } from "@/lib/types";

const TONE = { up: "positive", degraded: "warning", down: "negative" } as const;
const TEXT = { up: "Operational", degraded: "Degraded", down: "Unreachable" } as const;

/** Health of every backend. First render uses the server's check; then refreshes every 15 s. */
export function ServiceStatusGrid({ initial }: { initial: ServiceStatus[] }) {
  const { data = initial, dataUpdatedAt } = useServiceStatus(initial);
  return (
    <div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {data.map((s) => (
          <li key={s.name} className="flex min-w-0 flex-col gap-1 rounded-lg border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{s.name}</span>
              <Badge tone={TONE[s.state]}>{TEXT[s.state]}</Badge>
            </div>
            <span className="text-xs text-muted">{s.description}</span>
            {s.detail && <span className="truncate font-mono text-xs text-muted">{s.detail}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted" aria-live="polite" suppressHydrationWarning>
        Refreshes every 15 seconds{dataUpdatedAt ? ` · last checked ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ""}.
      </p>
    </div>
  );
}
