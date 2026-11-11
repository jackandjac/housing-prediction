"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { useCreateEstimate } from "@/hooks/useEstimates";
import { ApiError } from "@/lib/errors";
import { number } from "@/lib/format";
import {
  buildEstimateSchema,
  defaultValues,
  type EstimateFormInput,
  type EstimateFormOutput,
} from "@/lib/estimate-schema";
import type { Estimate, FormField } from "@/lib/types";

/**
 * Property form built from the model's input schema. Client-side rules mirror the server's;
 * server field errors (e.g. after a model switch) are mapped back onto the matching inputs.
 */
export function EstimateForm({ fields, onEstimate }: { fields: FormField[]; onEstimate: (e: Estimate) => void }) {
  const schema = useMemo(() => buildEstimateSchema(fields), [fields]);
  const create = useCreateEstimate();
  const form = useForm<EstimateFormInput, unknown, EstimateFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(fields),
    mode: "onTouched",
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      onEstimate(await create.mutateAsync(values));
    } catch (err) {
      if (err instanceof ApiError) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          const f = fields.find((x) => x.name === field);
          form.setError(field, { message: `${f?.label ?? field} ${message}` });
        }
      }
    }
  });

  const serverError = create.error instanceof ApiError && Object.keys(create.error.fieldErrors).length === 0 ? create.error : null;

  return (
    <form onSubmit={onSubmit} noValidate aria-describedby="form-help" className="space-y-5">
      <p id="form-help" className="text-sm text-muted">
        All fields are required. Values start from a typical property.
      </p>
      <Field id="label" label="Name (optional)" placeholder="e.g. 12 Maple Street" error={errors.label?.message} {...form.register("label")} />
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <Field
            key={f.name}
            id={f.name}
            label={f.label}
            unit={f.unit}
            type="number"
            inputMode="decimal"
            step={f.step}
            min={f.min ?? undefined}
            max={f.max ?? undefined}
            required
            hint={f.min != null && f.max != null ? `${number(f.min)} to ${number(f.max)}` : undefined}
            error={errors[f.name]?.message}
            {...form.register(f.name)}
          />
        ))}
      </div>
      {serverError && (
        <Alert title="Couldn’t get an estimate" tone="negative">
          {serverError.message}
        </Alert>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Estimating…" : "Get estimate"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            form.reset(defaultValues(fields));
            create.reset();
          }}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
