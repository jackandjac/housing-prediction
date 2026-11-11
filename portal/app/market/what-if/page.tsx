import type { Metadata } from "next";
import { Suspense } from "react";
import { WhatIfTool } from "@/components/market/WhatIfTool";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { getMeta, getSummary } from "@/lib/server/market";

export const metadata: Metadata = { title: "What-if" };

export default function WhatIfPage() {
  return (
    <>
      <PageHeader
        title="What-if analysis"
        description="Change one feature of a property across a range and see how the model’s predicted price responds, holding everything else fixed."
      />
      <Suspense fallback={<Skeleton className="h-[640px] w-full" />}>
        <Tool />
      </Suspense>
    </>
  );
}

async function Tool() {
  const [meta, summary] = await Promise.all([getMeta(), getSummary(new URLSearchParams())]);
  return <WhatIfTool meta={meta} averages={summary.featureAverages} />;
}
