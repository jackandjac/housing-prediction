import Link from "next/link";
import { Nav } from "./Nav";

const APPS = [
  { href: "/", label: "Overview", exact: true },
  { href: "/estimator", label: "Value Estimator" },
  { href: "/market", label: "Market Analysis" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" className="text-accent">
            <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="currentColor" />
          </svg>
          <span className="hidden sm:inline">Housing Insights</span>
        </Link>
        <Nav items={APPS} variant="main" label="Applications" />
      </div>
    </header>
  );
}
