import Link from "next/link";
import { Suspense } from "react";
import { ServiceStatusGrid } from "@/components/layout/ServiceStatusGrid";
import { Skeleton } from "@/components/ui/Feedback";
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
  {
    href: "/models",
    app: "models",
    title: "Model Studio",
    backend: "Python · FastAPI · scikit-learn",
    body: "Train new models from your own CSV, compare their accuracy, choose which one serves predictions, and watch the health of every service.",
    links: [
      { href: "/models", label: "Models" },
      { href: "/models/train", label: "Train a model" },
    ],
  },
] as const;

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">Housing Insights</h1>
      <p className="mt-2 max-w-prose text-muted">
        Three applications around one regression model: value individual properties, analyse the market as a whole, and
        train and manage the model itself.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
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
  return <ServiceStatusGrid initial={await getServiceStatus()} />;
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
