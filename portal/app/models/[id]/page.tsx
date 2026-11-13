import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CoefficientChart } from "@/components/charts/CoefficientChart";
import { ActivateButton } from "@/components/models/ActivateButton";
import { AdminAccess } from "@/components/models/AdminAccess";
import { Card } from "@/components/ui/Card";
import { Badge, Skeleton, Stat } from "@/components/ui/Feedback";
import { LocalTime } from "@/components/ui/LocalTime";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApiError } from "@/lib/errors";
import { featureLabel, featureValue, money, signedMoney } from "@/lib/format";
import { modelTypeLabel } from "@/lib/ml";
import { adminConfigured } from "@/lib/server/admin";
import { getModelInfo } from "@/lib/server/ml";
import { settle } from "@/lib/settle";

export async function generateMetadata({ params }: PageProps<"/models/[id]">): Promise<Metadata> {
  return { title: (await params).id };
}

export default function ModelPage({ params }: PageProps<"/models/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] w-full" />}>
      <Model params={params} />
    </Suspense>
  );
}

async function Model({ params }: { params: PageProps<"/models/[id]">["params"] }) {
  const { id } = await params;
  await connection();
  const configured = adminConfigured();
  const result = await settle(getModelInfo(id));
  if (!result.ok) {
    if (result.error instanceof ApiError && result.error.status === 404) notFound();
    throw result.error;
  }
  const m = result.data;
  const cv = m.metrics.cross_validation;
  const tr = m.metrics.training;

  return (
    <div className="space-y-6">
      <PageHeader
        title={m.model_id}
        description={
          <>
            {modelTypeLabel(m)} · trained <LocalTime iso={m.created_at} /> on {m.metrics.rows} rows
            {m.dataset.filename ? ` from ${m.dataset.filename}` : ""}
          </>
        }
        action={m.is_active ? <Badge tone="positive">Active</Badge> : <ActivateButton modelId={m.model_id} configured={configured} size="md" />}
      />
      {!m.is_active && <AdminAccess configured={configured} />}

      <section aria-labelledby="accuracy-heading" className="space-y-3">
        <h2 id="accuracy-heading" className="text-base font-semibold">Accuracy on unseen rows</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="R²" value={cv.r2.toFixed(3)} sub={`Fitted on all rows: ${tr.r2.toFixed(3)}`} />
          <Stat label="Avg error" value={money(cv.mae)} sub={`Fitted on all rows: ${money(tr.mae)}`} />
          <Stat label="RMS error" value={money(cv.rmse)} sub={`Fitted on all rows: ${money(tr.rmse)}`} />
          <Stat label="Folds" value={cv.folds} sub="Cross-validation splits" />
        </div>
        <p className="text-xs text-muted">
          The main figures come from cross-validation: each row is predicted by a model that never saw it. The “fitted on
          all rows” figures are optimistic, because the model was trained on those same rows.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {m.coefficients.standardized && (
          <Card title="What drives the price" description="Price change when a feature rises by one standard deviation.">
            <CoefficientChart coefficients={m.coefficients.standardized} />
          </Card>
        )}
        <Card title="Per-unit effect" description="Price change for one more unit of each feature, other features fixed.">
          <table className="w-full text-sm">
            <caption className="sr-only">Per-unit coefficients</caption>
            <thead className="text-left text-xs text-muted uppercase">
              <tr>
                <th scope="col" className="py-1.5 font-medium">Feature</th>
                <th scope="col" className="py-1.5 text-right font-medium">Per unit</th>
                {m.scaler && <th scope="col" className="py-1.5 text-right font-medium">Training average</th>}
              </tr>
            </thead>
            <tbody className="tabular">
              {m.features.map((f) => (
                <tr key={f} className="border-t border-line">
                  <th scope="row" className="py-1.5 text-left font-normal">{featureLabel(f)}</th>
                  <td className="py-1.5 text-right">{signedMoney(m.coefficients.per_unit[f])}</td>
                  {m.scaler && <td className="py-1.5 text-right">{featureValue(f, m.scaler.mean[f])}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {m.coefficients.standardized_intercept != null && (
            <p className="mt-3 text-xs text-muted">
              Average training price: {money(m.coefficients.standardized_intercept)}. A house at every training average is
              priced at about this.
            </p>
          )}
        </Card>
      </div>

      <Card title="Training data">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted uppercase">File</dt><dd>{m.dataset.filename ?? "–"}</dd></div>
          <div><dt className="text-xs text-muted uppercase">Training job</dt><dd className="font-mono text-xs">{m.training_id}</dd></div>
          <div className="sm:col-span-2 min-w-0"><dt className="text-xs text-muted uppercase">SHA-256</dt><dd className="truncate font-mono text-xs">{m.dataset.sha256 ?? "–"}</dd></div>
          {m.dataset.ignored_columns && m.dataset.ignored_columns.length > 0 && (
            <div className="sm:col-span-2"><dt className="text-xs text-muted uppercase">Ignored columns</dt><dd>{m.dataset.ignored_columns.join(", ")}</dd></div>
          )}
        </dl>
      </Card>
    </div>
  );
}
