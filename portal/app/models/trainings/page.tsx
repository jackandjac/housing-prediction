import type { Metadata } from "next";
import { Suspense } from "react";
import { TrainingsTable } from "@/components/models/TrainingsTable";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { getTrainings } from "@/lib/server/ml";

export const metadata: Metadata = { title: "Training jobs" };

export default function TrainingsPage() {
  return (
    <>
      <PageHeader title="Training jobs" description="Every upload that passed validation, newest first. Running jobs update live." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Jobs />
      </Suspense>
    </>
  );
}

async function Jobs() {
  return <TrainingsTable initial={await getTrainings(50)} />;
}
