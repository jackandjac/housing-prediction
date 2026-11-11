import type { ComponentProps } from "react";
import { cn } from "./cn";

/** Labelled input with hint and error wired up for screen readers (WCAG 1.3.1, 3.3.1). */
export function Field({
  id,
  label,
  hint,
  unit,
  error,
  className,
  ...input
}: ComponentProps<"input"> & { id: string; label: string; hint?: string; unit?: string | null; error?: string }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {unit && <span className="ml-1 font-normal text-muted">({unit})</span>}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className={cn(
          "h-10 w-full rounded-lg border bg-surface px-3 text-sm tabular",
          error ? "border-negative" : "border-line hover:border-muted",
        )}
        {...input}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

export function Select({
  id,
  label,
  children,
  className,
  ...select
}: ComponentProps<"select"> & { id: string; label: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm hover:border-muted"
        {...select}
      >
        {children}
      </select>
    </div>
  );
}
