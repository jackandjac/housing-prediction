"use client";

import Link from "next/link";
import { Alert, Badge, EmptyState } from "@/components/ui/Feedback";
import { LocalTime } from "@/components/ui/LocalTime";
import { ButtonLink } from "@/components/ui/Button";
import { useLastActivation, useModels } from "@/hooks/useMl";
import { errorMessage } from "@/lib/errors";
import { modelTypeLabel } from "@/lib/ml";
import { money } from "@/lib/format";
import type { ModelSummary } from "@/lib/types";
import { ActivateButton, SWITCH_NOTE } from "./ActivateButton";

/** Every trained model, newest first. Accuracy is cross-validated (held-out rows). */
export function ModelTable({ initial, configured }: { initial: ModelSummary[]; configured: boolean }) {
  const models = useModels(initial);
  const activated = useLastActivation();
  const data = [...(models.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (data.length === 0) {
    return (
      <EmptyState title="No models yet" action={<ButtonLink href="/models/train">Train a model</ButtonLink>}>
        Upload a training CSV to create the first model. It becomes active automatically.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {models.error && <Alert title="Couldn’t refresh the model list">{errorMessage(models.error)}</Alert>}
      {activated && (
        <Alert tone="positive" title={`${activated} is now active`}>
          {SWITCH_NOTE}
        </Alert>
      )}
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Trained models</caption>
          <thead className="bg-surface-2 text-left text-xs text-muted uppercase">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Model</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Trained</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Rows</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">R² (held-out)</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Avg error (held-out)</th>
              <th scope="col" className="px-4 py-2.5 font-medium"><span className="sr-only">Status</span></th>
            </tr>
          </thead>
          <tbody className="tabular">
            {data.map((m) => (
              <tr key={m.model_id} className="border-t border-line align-middle">
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <Link href={`/models/${m.model_id}`} className="font-mono text-xs text-accent hover:underline">
                    {m.model_id}
                  </Link>
                  {m.dataset.filename && <div className="mt-0.5 truncate text-xs text-muted">{m.dataset.filename}</div>}
                </th>
                <td className="px-4 py-3">{modelTypeLabel(m)}</td>
                <td className="px-4 py-3 whitespace-nowrap"><LocalTime iso={m.created_at} /></td>
                <td className="px-4 py-3 text-right">{m.metrics.rows}</td>
                <td className="px-4 py-3 text-right">{m.metrics.cross_validation.r2.toFixed(3)}</td>
                <td className="px-4 py-3 text-right">{money(m.metrics.cross_validation.mae)}</td>
                <td className="px-4 py-3 text-right">
                  {m.is_active ? <Badge tone="positive">Active</Badge> : <ActivateButton modelId={m.model_id} configured={configured} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
