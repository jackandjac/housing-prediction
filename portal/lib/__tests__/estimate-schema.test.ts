import { describe, expect, it } from "vitest";
import { buildEstimateSchema, defaultValues } from "../estimate-schema";
import type { FormField } from "../types";

const fields: FormField[] = [
  { name: "square_footage", label: "Living area", type: "float", min: 100, max: 20000, step: 1, unit: "sq ft", description: "", example: 1550 },
  { name: "bedrooms", label: "Bedrooms", type: "int", min: 0, max: 20, step: 1, unit: null, description: "", example: 3 },
  { name: "school_rating", label: "School rating", type: "float", min: 0, max: 10, step: 0.1, unit: "0–10", description: "", example: 7.6 },
];
const schema = buildEstimateSchema(fields);

function errors(input: Record<string, string>) {
  const r = schema.safeParse(input);
  if (r.success) return {};
  return Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe("buildEstimateSchema", () => {
  it("parses valid strings into numbers and a request body", () => {
    const r = schema.parse({ label: "  Maple St ", square_footage: "1550", bedrooms: "3", school_rating: "7.6" });
    expect(r).toEqual({ label: "Maple St", features: { square_footage: 1550, bedrooms: 3, school_rating: 7.6 } });
  });

  it("drops an empty label", () => {
    expect(schema.parse({ label: "", square_footage: "1550", bedrooms: "3", school_rating: "7" }).label).toBeUndefined();
  });

  it("reports one clear message per field", () => {
    expect(errors({ square_footage: "", bedrooms: "2.5", school_rating: "11" })).toEqual({
      square_footage: "Living area is required",
      bedrooms: "Bedrooms must be a whole number",
      school_rating: "School rating must be at most 10",
    });
  });

  it("includes the unit in range messages", () => {
    expect(errors({ square_footage: "50", bedrooms: "3", school_rating: "7" }).square_footage).toBe(
      "Living area must be at least 100 sq ft",
    );
  });

  it("rejects text", () => {
    expect(errors({ square_footage: "big", bedrooms: "3", school_rating: "7" }).square_footage).toBe(
      "Living area must be a number",
    );
  });

  it("builds defaults from examples", () => {
    expect(defaultValues(fields)).toEqual({ label: "", square_footage: "1550", bedrooms: "3", school_rating: "7.6" });
  });
});
