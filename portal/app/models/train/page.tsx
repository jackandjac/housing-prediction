import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminAccess } from "@/components/models/AdminAccess";
import { TrainForm } from "@/components/models/TrainForm";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { featureLabel } from "@/lib/format";
import { adminConfigured } from "@/lib/server/admin";
import { getMlFeatures } from "@/lib/server/ml";
import { settle } from "@/lib/settle";

export const metadata: Metadata = { title: "Train" };

export default function TrainPage() {
  return (
    <>
      <PageHeader
        title="Train a model"
        description="Upload training data and pick a model type. The file is checked before training starts, and you can follow the job here."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Train />
      </Suspense>
    </>
  );
}

async function Train() {
  await connection();
  const configured = adminConfigured();
  const features = await settle(getMlFeatures());
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-4">
        <AdminAccess configured={configured} />
        <Card title="Training settings">
          <TrainForm configured={configured} />
        </Card>
      </div>
      <Card title="What the file needs" description="One row per property, with a header row.">
        {features.ok ? (
          <div className="space-y-3 text-sm">
            <ul className="divide-y divide-line">
              {features.data.features.map((f) => (
                <li key={f.name} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span>
                    <code className="font-mono text-xs">{f.name}</code>
                    <span className="ml-2 text-muted">{featureLabel(f.name)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted tabular">
                    {f.type}
                    {f.min != null && f.max != null ? ` · ${f.min}–${f.max}` : ""}
                  </span>
                </li>
              ))}
              <li className="flex items-baseline justify-between gap-3 py-1.5">
                <span>
                  <code className="font-mono text-xs">{features.data.target}</code>
                  <span className="ml-2 text-muted">Sale price (what the model learns)</span>
                </span>
                <span className="text-xs text-muted">number</span>
              </li>
            </ul>
            <p className="text-muted">
              Extra columns are ignored. Problems such as missing columns, empty cells or values out of range are listed
              with their line numbers, and nothing is trained until the file is fixed.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">The column list isn’t available because the ML service can’t be reached.</p>
        )}
      </Card>
    </div>
  );
}
