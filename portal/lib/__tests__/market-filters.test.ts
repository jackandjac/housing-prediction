import { describe, expect, it } from "vitest";
import { countActive, filterParams, parseFilters, toSearchParams, withFilters } from "../market-filters";

describe("market filters", () => {
  it("parses <column>.min/max and ignores other or invalid params", () => {
    const p = new URLSearchParams("bedrooms.min=3&price.max=300000&sort=price&year_built.min=&x.min=abc");
    expect(parseFilters(p)).toEqual({ bedrooms: { min: 3 }, price: { max: 300000 } });
  });

  it("round-trips in a stable order", () => {
    const f = { price: { max: 300000 }, bedrooms: { min: 3, max: 4 } };
    expect(filterParams(f).toString()).toBe("bedrooms.min=3&bedrooms.max=4&price.max=300000");
    expect(parseFilters(filterParams(f))).toEqual(f);
  });

  it("keeps sort and groupBy but resets paging when filters change", () => {
    const current = new URLSearchParams("sort=price&dir=asc&page=3&bedrooms.min=2");
    expect(withFilters(current, { price: { min: 200000 } }).toString()).toBe("sort=price&dir=asc&price.min=200000");
  });

  it("counts active filters", () => {
    expect(countActive({ a: { min: 1 }, b: {}, c: { max: 2 } })).toBe(2);
  });

  it("converts Next.js searchParams objects", () => {
    expect(toSearchParams({ a: "1", b: ["2", "3"], c: undefined }).toString()).toBe("a=1&b=2&b=3");
  });
});
