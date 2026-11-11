import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryTable } from "@/components/estimator/HistoryTable";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { getEstimates } from "@/lib/server/estimator";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <>
      <PageHeader title="Estimate history" description="Every estimate is saved. Select two to four to compare them." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <History />
      </Suspense>
    </>
  );
}

/** First page is rendered on the server; paging and deletes then run client-side via TanStack Query. */
async function History() {
  const initial = await getEstimates(10, 0);
  return <HistoryTable initialData={initial} />;
}
