import { z } from "zod";
import type { FormField } from "./types";

/** Form values as typed into inputs (strings), keyed by feature name, plus an optional label. */
export type EstimateFormInput = Record<string, string>;
export type EstimateFormOutput = { label?: string; features: Record<string, number> };

function fmt(n: number) {
  return Number.isInteger(n) ? n.toLocaleString("en-US") : String(n);
}

/** Zod rules for one field, built from the backend's form schema (same rules the server applies). */
export function fieldSchema(f: FormField) {
  const unit = f.unit && !f.unit.includes("–") ? ` ${f.unit}` : "";
  let num = z.number({ error: `${f.label} must be a number` }).refine(Number.isFinite, `${f.label} must be a number`);
  if (f.type === "int") num = num.refine(Number.isInteger, `${f.label} must be a whole number`);
  if (f.min != null) num = num.refine((v) => v >= f.min!, `${f.label} must be at least ${fmt(f.min)}${unit}`);
  if (f.max != null) num = num.refine((v) => v <= f.max!, `${f.label} must be at most ${fmt(f.max)}${unit}`);
  return z
    .string()
    .trim()
    .min(1, `${f.label} is required`)
    .transform((s) => Number(s))
    .pipe(num);
}

/**
 * Whole-form schema. Input: flat strings keyed by field name (plus "label").
 * Output: { label, features } ready to POST to /estimates.
 */
export function buildEstimateSchema(fields: FormField[]) {
  const shape: Record<string, z.ZodType<number, string>> = {};
  for (const f of fields) shape[f.name] = fieldSchema(f);
  return z
    .object({
      label: z.string().trim().max(80, "Name must be 80 characters or fewer").optional(),
      ...shape,
    })
    .transform(({ label, ...features }) => ({
      label: label || undefined,
      features: features as Record<string, number>,
    }));
}

/** Initial form values: each field's example, as a string. */
export function defaultValues(fields: FormField[]): EstimateFormInput {
  const values: EstimateFormInput = { label: "" };
  for (const f of fields) values[f.name] = f.example != null ? String(f.example) : "";
  return values;
}
