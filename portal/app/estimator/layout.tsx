import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = { title: { default: "Value Estimator", template: "%s · Value Estimator" } };

const TABS = [
  { href: "/estimator", label: "New estimate", exact: true },
  { href: "/estimator/history", label: "History" },
  { href: "/estimator/compare", label: "Compare" },
];

export default function EstimatorLayout({ children }: LayoutProps<"/estimator">) {
  return (
    <AppShell app="estimator" title="Property Value Estimator" backend="Python · FastAPI" tabs={TABS}>
      {children}
    </AppShell>
  );
}
