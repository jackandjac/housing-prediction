import { describe, expect, it } from "vitest";
import { toApiError } from "../errors";

describe("toApiError", () => {
  it("keeps estimator-api field errors by field", () => {
    const e = toApiError(422, { detail: { message: "Invalid.", errors: [{ field: "bedrooms", message: "must be at most 20" }] } }, "x");
    expect(e.fieldErrors).toEqual({ bedrooms: "must be at most 20" });
    expect(e.errors).toEqual(["bedrooms must be at most 20"]);
  });

  it("keeps ml-api string errors as messages", () => {
    const e = toApiError(422, { detail: { message: "invalid training data", errors: ["line 4: price is empty"] } }, "x");
    expect(e.message).toBe("invalid training data");
    expect(e.errors).toEqual(["line 4: price is empty"]);
    expect(e.fieldErrors).toEqual({});
  });

  it("reads Spring problem details and plain string details", () => {
    expect(toApiError(400, { title: "Invalid request", detail: "Invalid filters", errors: ["bad"] }, "x").errors).toEqual(["bad"]);
    expect(toApiError(409, { detail: "model is not compatible" }, "x").message).toBe("model is not compatible");
  });
});
