import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, isFinished, jobDuration, mlRouteKind, validateTrainingInput } from "../ml";

describe("mlRouteKind", () => {
  it("allows the read endpoints Model Studio uses", () => {
    for (const p of [["trainings"], ["models"], ["model-info"], ["features"], ["health"], ["trainings", "trn_abc123"]]) {
      expect(mlRouteKind("GET", p)).toBe("read");
    }
  });

  it("allows only the two write endpoints, as writes", () => {
    expect(mlRouteKind("POST", ["trainings"])).toBe("write");
    expect(mlRouteKind("PUT", ["models", "active"])).toBe("write");
  });

  it("refuses everything else, including path tricks", () => {
    expect(mlRouteKind("POST", ["predict"])).toBeNull();
    expect(mlRouteKind("GET", ["docs"])).toBeNull();
    expect(mlRouteKind("DELETE", ["models"])).toBeNull();
    expect(mlRouteKind("PUT", ["models", "mdl_1"])).toBeNull();
    expect(mlRouteKind("GET", ["trainings", ".."])).toBeNull();
    expect(mlRouteKind("GET", ["trainings", "a", "b"])).toBeNull();
    expect(mlRouteKind("GET", ["models", ".."])).toBeNull();
    expect(mlRouteKind("GET", [])).toBeNull();
  });
});

describe("validateTrainingInput", () => {
  const csv = { name: "houses.csv", size: 2048 };

  it("accepts a CSV with ridge and a positive alpha", () => {
    expect(validateTrainingInput({ file: csv, modelType: "ridge", alpha: "0.5" })).toEqual({});
  });

  it("ignores alpha for linear models", () => {
    expect(validateTrainingInput({ file: csv, modelType: "linear", alpha: "" })).toEqual({});
  });

  it("reports missing, wrong-type, empty and oversized files", () => {
    expect(validateTrainingInput({ file: null, modelType: "linear", alpha: "1" }).file).toBe("Choose a CSV file");
    expect(validateTrainingInput({ file: { name: "a.xlsx", size: 5 }, modelType: "linear", alpha: "1" }).file).toMatch(/\.csv/);
    expect(validateTrainingInput({ file: { name: "a.csv", size: 0 }, modelType: "linear", alpha: "1" }).file).toMatch(/empty/);
    expect(validateTrainingInput({ file: { name: "a.csv", size: MAX_UPLOAD_BYTES + 1 }, modelType: "linear", alpha: "1" }).file).toMatch(/5 MB/);
  });

  it("rejects a non-positive or non-numeric alpha", () => {
    for (const alpha of ["0", "-1", "abc", ""]) {
      expect(validateTrainingInput({ file: csv, modelType: "ridge", alpha }).alpha).toBeDefined();
    }
  });
});

describe("job helpers", () => {
  it("knows which statuses are final", () => {
    expect(isFinished("succeeded")).toBe(true);
    expect(isFinished("failed")).toBe(true);
    expect(isFinished("running")).toBe(false);
    expect(isFinished("submitted")).toBe(false);
  });

  it("formats durations and returns null while running", () => {
    const at = "2026-11-11T10:00:00+00:00";
    expect(jobDuration({ created_at: at, finished_at: null })).toBeNull();
    expect(jobDuration({ created_at: at, finished_at: "2026-11-11T10:00:00.040+00:00" })).toBe("under 1 s");
    expect(jobDuration({ created_at: at, finished_at: "2026-11-11T10:00:01.250+00:00" })).toBe("1.3 s");
    expect(jobDuration({ created_at: at, finished_at: "2026-11-11T10:00:45+00:00" })).toBe("45 s");
    expect(jobDuration({ created_at: at, finished_at: "2026-11-11T10:03:04+00:00" })).toBe("3 min 4 s");
  });
});
