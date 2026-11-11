import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "accent" | "positive" | "negative" | "warning";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
  positive: "bg-positive-soft text-positive",
  negative: "bg-negative-soft text-negative",
  warning: "bg-warning-soft text-warning",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Inline message. role="alert" for errors so screen readers announce them. */
export function Alert({
  tone = "negative",
  title,
  children,
  action,
}: {
  tone?: Exclude<Tone, "neutral" | "accent">;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role={tone === "negative" ? "alert" : "status"}
      className={cn("flex flex-wrap items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm", tones[tone])}
    >
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-1 text-fg/80">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-surface-2", className)} />;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-prose text-sm text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tabular">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}
