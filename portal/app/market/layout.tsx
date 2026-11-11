import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = { title: { default: "Market Analysis", template: "%s · Market Analysis" } };

const TABS = [
  { href: "/market", label: "Dashboard", exact: true },
  { href: "/market/properties", label: "Properties" },
  { href: "/market/what-if", label: "What-if" },
];

export default function MarketLayout({ children }: LayoutProps<"/market">) {
  return (
    <AppShell app="market" title="Property Market Analysis" backend="Java 21 · Spring Boot" tabs={TABS}>
      {children}
    </AppShell>
  );
}
