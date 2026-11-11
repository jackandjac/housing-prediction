import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EstimateResult } from "@/components/estimator/EstimateResult";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Feedback";
import { ApiError } from "@/lib/errors";
import { getEstimate } from "@/lib/server/estimator";
import { settle } from "@/lib/settle";

export const metadata: Metadata = { title: "Estimate" };

export default function EstimatePage({ params }: PageProps<"/estimator/estimates/[id]">) {
  return (
    <div className="space-y-4">
      <ButtonLink href="/estimator/history" variant="ghost" size="sm">
        ← Back to history
      </ButtonLink>
      <Suspense fallback={<Skeleton className="h-[520px] w-full" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

async function Detail({ params }: { params: PageProps<"/estimator/estimates/[id]">["params"] }) {
  const { id } = await params;
  const result = await settle(getEstimate(id));
  if (!result.ok) {
    if (result.error instanceof ApiError && result.error.status === 404) notFound();
    throw result.error;
  }
  return (
    <Card>
      <EstimateResult estimate={result.data} />
    </Card>
  );
}
