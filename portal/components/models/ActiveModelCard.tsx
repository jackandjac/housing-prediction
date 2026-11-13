import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState, Stat } from "@/components/ui/Feedback";
import { ButtonLink } from "@/components/ui/Button";
import { money } from "@/lib/format";
import { modelTypeLabel } from "@/lib/ml";
import type { ModelSummary } from "@/lib/types";

/** The model currently serving predictions to both apps, with held-out accuracy. */
export function ActiveModelCard({ model }: { model: ModelSummary | null }) {
  if (!model) {
    return (
      <Card title="Active model">
        <EmptyState title="No model is serving predictions" action={<ButtonLink href="/models/train">Train a model</ButtonLink>}>
          The estimator and market apps need an active model for prices and what-if analysis.
        </EmptyState>
      </Card>
    );
  }
  const cv = model.metrics.cross_validation;
  return (
    <Card
      title="Active model"
      description={
        <>
          <Link href={`/models/${model.model_id}`} className="font-mono text-accent hover:underline">
            {model.model_id}
          </Link>{" "}
          · {modelTypeLabel(model)} · trained on {model.metrics.rows} rows
          {model.dataset.filename ? ` from ${model.dataset.filename}` : ""}
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="R² (held-out)" value={cv.r2.toFixed(3)} sub="1.0 is a perfect fit" />
        <Stat label="Avg error" value={money(cv.mae)} sub="Mean absolute error" />
        <Stat label="RMS error" value={money(cv.rmse)} sub="Penalises big misses" />
        <Stat label="Folds" value={cv.folds} sub="Cross-validation splits" />
      </div>
      <p className="mt-3 text-xs text-muted">
        Measured on rows each fold held back, so these reflect accuracy on houses the model hasn’t seen.
      </p>
    </Card>
  );
}
