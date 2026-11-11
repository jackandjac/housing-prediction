import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareStart } from "@/components/estimator/CompareStart";
import { CompareView } from "@/components/estimator/CompareView";
import { ButtonLink } from "@/components/ui/Button";
import { Alert, Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApiError } from "@/lib/errors";
import { getComparison } from "@/lib/server/estimator";
import { settle } from "@/lib/settle";

export const metadata: Metadata = { title: "Compare" };

export default function ComparePage({ searchParams }: PageProps<"/estimator/compare">) {
  return (
    <>
      <PageHeader title="Compare properties" description="Estimates side by side, with the effect of each feature." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Comparison searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Comparison({ searchParams }: { searchParams: PageProps<"/estimator/compare">["searchParams"] }) {
  const raw = (await searchParams).ids;
  const ids = (Array.isArray(raw) ? raw.join(",") : (raw ?? "")).split(",").filter(Boolean);
  if (ids.length < 2) return <CompareStart />;
  const result = await settle(getComparison(ids));
  if (result.ok) return <CompareView comparison={result.data} />;
  const err = result.error;
  // Expected user-facing cases (deleted or too many estimates) get an inline message; outages go to error.tsx.
  if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
    return (
        <Alert
          tone="warning"
          title="These estimates can’t be compared"
          action={<ButtonLink href="/estimator/history" size="sm" variant="secondary">Choose again</ButtonLink>}
        >
          {err.message}
        </Alert>
    );
  }
  throw err;
}
