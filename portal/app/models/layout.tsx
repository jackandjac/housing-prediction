import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = { title: { default: "Model Studio", template: "%s · Model Studio" } };

const TABS = [
  { href: "/models", label: "Overview", exact: true },
  { href: "/models/train", label: "Train" },
  { href: "/models/trainings", label: "Training jobs" },
];

export default function ModelsLayout({ children }: LayoutProps<"/models">) {
  return (
    <AppShell app="models" title="Model Studio" backend="Python · FastAPI · scikit-learn" tabs={TABS}>
      {children}
    </AppShell>
  );
}
