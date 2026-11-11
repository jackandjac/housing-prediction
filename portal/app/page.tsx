import Link from "next/link";
import { Suspense } from "react";
import { Badge, Skeleton } from "@/components/ui/Feedback";
import { getServiceStatus } from "@/lib/server/status";

const APPS = [
  {
    href: "/estimator",
    app: "estimator",
    title: "Property Value Estimator",
    backend: "Python · FastAPI · MongoDB",
    body: "Enter a property’s details to get a price estimate with a breakdown of what drives it. Keep a history and compare up to four properties side by side.",
    links: [
      { href: "/estimator", label: "New estimate" },
      { href: "/estimator/history", label: "History" },
    ],
  },
  {
    href: "/market",
    app: "market",
    title: "Property Market Analysis",
    backend: "Java 21 · Spring Boot",
    body: "Explore prices across segments with filters, test what-if scenarios against the model, and export the data as CSV or PDF.",
    links: [
      { href: "/market", label: "Dashboard" },
      { href: "/market/what-if", label: "What-if analysis" },
    ],
  },
] as const;

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">Housing Insights</h1>
      <p className="mt-2 max-w-prose text-muted">
        Two applications on one regression model: one values individual properties, the other analyses the market as a
        whole.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {APPS.map((a) => (
          <article
            key={a.href}
            data-app={a.app}
            className="group relative flex min-w-0 flex-col rounded-[var(--radius-card)] border border-line bg-surface p-6 transition-colors hover:border-accent"
          >
            <span aria-hidden className="mb-4 h-1.5 w-10 rounded-full bg-accent" />
            <h2 className="text-lg font-semibold">
              <Link href={a.href} className="after:absolute after:inset-0">
                {a.title}
              </Link>
            </h2>
            <p className="mt-1 font-mono text-xs text-muted">{a.backend}</p>
            <p className="mt-3 flex-1 text-sm">{a.body}</p>
            <div className="relative z-10 mt-5 flex flex-wrap gap-4 text-sm font-medium">
              {a.links.map((l) => (
                <Link key={l.href} href={l.href} className="text-accent hover:underline">
                  {l.label} →
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>

      <section aria-labelledby="status-heading" className="mt-10">
        <h2 id="status-heading" className="text-sm font-semibold tracking-wide text-muted uppercase">
          Service status
        </h2>
        <Suspense fallback={<StatusSkeleton />}>
          <ServiceStatus />
        </Suspense>
      </section>
    </div>
  );
}

async function ServiceStatus() {
  const services = await getServiceStatus();
  const tone = { up: "positive", degraded: "warning", down: "negative" } as const;
  const text = { up: "Operational", degraded: "Degraded", down: "Unreachable" } as const;
  return (
    <ul className="mt-3 grid gap-3 sm:grid-cols-3">
      {services.map((s) => (
        <li key={s.name} className="flex min-w-0 flex-col gap-1 rounded-lg border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{s.name}</span>
            <Badge tone={tone[s.state]}>{text[s.state]}</Badge>
          </div>
          <span className="text-xs text-muted">{s.description}</span>
          {s.detail && <span className="truncate font-mono text-xs text-muted">{s.detail}</span>}
        </li>
      ))}
    </ul>
  );
}

function StatusSkeleton() {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-3" aria-busy="true" aria-label="Checking services">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[76px]" />
      ))}
    </div>
  );
}
