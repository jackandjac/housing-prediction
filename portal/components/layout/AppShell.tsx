import type { ReactNode } from "react";
import { Nav } from "./Nav";
import type { NavItem } from "./NavLinks";

/** Layout shared by both apps: app title, backend badge, section tabs. Sets the app accent colour. */
export function AppShell({
  app,
  title,
  backend,
  tabs,
  children,
}: {
  app: "estimator" | "market";
  title: string;
  backend: string;
  tabs: NavItem[];
  children: ReactNode;
}) {
  return (
    <div data-app={app} className="flex flex-1 flex-col">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <span aria-hidden className="h-6 w-1.5 rounded-full bg-accent" />
            <p className="text-lg font-semibold">{title}</p>
            <span className="rounded-full border border-line px-2 py-0.5 font-mono text-xs text-muted">{backend}</span>
          </div>
          <div className="mt-3">
            <Nav items={tabs} variant="sub" label={`${title} sections`} />
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
