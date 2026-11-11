import type { ReactNode } from "react";
import { cn } from "./cn";

export function Card({
  title,
  description,
  action,
  children,
  className,
  as: Tag = "section",
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag className={cn("min-w-0 rounded-[var(--radius-card)] border border-line bg-surface p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-balance">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </Tag>
  );
}
