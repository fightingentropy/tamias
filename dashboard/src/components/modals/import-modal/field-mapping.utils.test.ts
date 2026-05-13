import { describe, expect, it } from "bun:test";
import {
  getBalanceFromLatestDate,
  isActiveRequest,
  shouldApplyMappedColumn,
} from "./field-mapping.utils";

describe("isActiveRequest", () => {
  it("returns true when request id matches active request", () => {
    const activeRequestRef = { current: 2 };
    expect(isActiveRequest(2, activeRequestRef)).toBe(true);
  });

  it("returns false for stale request id", () => {
    const activeRequestRef = { current: 3 };
    expect(isActiveRequest(2, activeRequestRef)).toBe(false);
  });
});

describe("shouldApplyMappedColumn", () => {
  const fileColumns = ["Transaction Date", "Description", "Amount"];

  it("accepts valid mapped field and exact column name", () => {
    expect(shouldApplyMappedColumn("date", "Transaction Date", fileColumns)).toBe(true);
  });

  it("rejects unknown field keys", () => {
    expect(shouldApplyMappedColumn("merchant", "Description", fileColumns)).toBe(false);
  });

  it("rejects values that are not present columns", () => {
    expect(shouldApplyMappedColumn("amount", "Total", fileColumns)).toBe(false);
  });
});

describe("getBalanceFromLatestDate", () => {
  it("returns the balance from the latest dated row", () => {
    expect(
      getBalanceFromLatestDate(
        [
          { date: "2026-01-01", balance: "1996.12" },
          { date: "2026-04-30", balance: "474.73" },
          { date: "2026-04-30", balance: "461.78" },
          { date: "2026-02-01", balance: "1000.00" },
        ],
        "date",
        "balance",
      ),
    ).toBe("461.78");
  });

  it("returns undefined when no balance column is mapped", () => {
    expect(
      getBalanceFromLatestDate([{ date: "2026-04-30", balance: "461.78" }], "date", "None"),
    ).toBeUndefined();
  });
});
