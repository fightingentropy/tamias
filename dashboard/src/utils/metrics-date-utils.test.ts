import { expect, test } from "bun:test";
import { currentUkTaxYear } from "@tamias/compliance/self-assessment";
import { getPeriodDateRange, isPeriodOption } from "./metrics-date-utils";

test("UK tax years change at midnight in London on 6 April", () => {
  const before = new Date("2026-04-05T22:59:59Z");
  const after = new Date("2026-04-05T23:00:00Z");
  expect(currentUkTaxYear(before)).toBe(2025);
  expect(currentUkTaxYear(after)).toBe(2026);
  expect(getPeriodDateRange("tax-year", undefined, undefined, undefined, before)).toEqual({
    from: "2025-04-06",
    to: "2026-04-05",
  });
  expect(getPeriodDateRange("tax-year", undefined, undefined, undefined, after)).toEqual({
    from: "2026-04-06",
    to: "2026-04-06",
  });
  expect(getPeriodDateRange("previous-tax-year", undefined, undefined, undefined, after)).toEqual({
    from: "2025-04-06",
    to: "2026-04-05",
  });
});

test("calendar and UK tax periods survive filter validation", () => {
  expect(isPeriodOption("this-year")).toBe(true);
  expect(isPeriodOption("tax-year")).toBe(true);
  expect(isPeriodOption("previous-tax-year")).toBe(true);
  expect(isPeriodOption("invalid")).toBe(false);
});
