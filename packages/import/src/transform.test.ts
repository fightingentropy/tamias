import { describe, expect, it } from "bun:test";
import { addDuplicateDisambiguators, transform } from "./transform";

const baseTransaction = {
  teamId: "team-1",
  bankAccountId: "bank-1",
  date: "2026-02-25",
  amount: "100.50",
  currency: "sek",
  description: "Coffee Shop",
  counterparty: "Acme AB",
};

describe("transform internal_id", () => {
  it("generates deterministic internal_id for identical input", () => {
    const first = transform({
      transaction: baseTransaction,
      inverted: false,
    });
    const second = transform({
      transaction: baseTransaction,
      inverted: false,
    });

    expect(first.internal_id).toBe(second.internal_id);
  });

  it("changes internal_id when transaction fingerprint changes", () => {
    const first = transform({
      transaction: baseTransaction,
      inverted: false,
    });
    const second = transform({
      transaction: {
        ...baseTransaction,
        amount: "101.50",
      },
      inverted: false,
    });

    expect(first.internal_id).not.toBe(second.internal_id);
  });

  it("adds stable disambiguators only after the first duplicate fingerprint", () => {
    const duplicateRows = addDuplicateDisambiguators({
      transactions: [
        baseTransaction,
        {
          ...baseTransaction,
          balance: "95.50",
        },
        {
          ...baseTransaction,
          amount: "101.50",
        },
      ],
      inverted: false,
    });

    expect(duplicateRows[0]?.duplicateIndex).toBeUndefined();
    expect(duplicateRows[1]?.duplicateIndex).toBe(2);
    expect(duplicateRows[2]?.duplicateIndex).toBeUndefined();

    const unsalted = transform({
      transaction: baseTransaction,
      inverted: false,
    });
    const transformed = duplicateRows.map((transaction) =>
      transform({ transaction, inverted: false }),
    );

    expect(transformed[0]?.internal_id).toBe(unsalted.internal_id);
    expect(transformed[1]?.internal_id).not.toBe(transformed[0]?.internal_id);
    expect(transformed[2]?.internal_id).not.toBe(transformed[0]?.internal_id);
  });
});
