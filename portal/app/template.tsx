import type { ReactNode } from "react";

/** Re-mounts on every navigation, so each page fades in (disabled for reduced motion in globals.css). */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter flex flex-1 flex-col">{children}</div>;
}
