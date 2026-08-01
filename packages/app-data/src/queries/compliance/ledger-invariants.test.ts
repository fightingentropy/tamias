import { describe, expect, test } from "bun:test";
import { assertJournalEntryConservesValue } from "./ledger";

describe("compliance journal conservation", () => {
  test("accepts a balanced double-entry journal", () => {
    expect(() =>
      assertJournalEntryConservesValue([
        { accountCode: "1000", debit: 125.5, credit: 0 },
        { accountCode: "4000", debit: 0, credit: 125.5 },
      ]),
    ).not.toThrow();
  });

  test("rejects imbalance, non-finite values, double-sided lines, and zero lines", () => {
    expect(() =>
      assertJournalEntryConservesValue([
        { accountCode: "1000", debit: 100 },
        { accountCode: "4000", credit: 99 },
      ]),
    ).toThrow("does not conserve value");
    expect(() =>
      assertJournalEntryConservesValue([
        { accountCode: "1000", debit: Number.NaN },
        { accountCode: "4000", credit: 1 },
      ]),
    ).toThrow("finite");
    expect(() =>
      assertJournalEntryConservesValue([
        { accountCode: "1000", debit: 1, credit: 1 },
        { accountCode: "4000", credit: 1 },
      ]),
    ).toThrow("both a debit and a credit");
    expect(() =>
      assertJournalEntryConservesValue([
        { accountCode: "1000", debit: 0 },
        { accountCode: "4000", credit: 0 },
      ]),
    ).toThrow("zero value");
  });
});
