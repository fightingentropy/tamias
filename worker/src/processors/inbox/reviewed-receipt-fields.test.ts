import { describe, expect, test } from "bun:test";
import { reviewedReceiptFields } from "./reviewed-receipt-fields";

describe("reviewed receipt extraction", () => {
  test("retains reviewed corrections instead of replacing them with extraction", () => {
    const extracted = { displayName: "OCR name", amount: 190, currency: "USD", date: "2026-09-01" };
    const capturedFields = {
      displayName: "Reviewed merchant",
      amount: 19,
      currency: "GBP",
      date: "2026-09-02",
      note: "Reviewed note",
    };
    expect({
      ...extracted,
      ...reviewedReceiptFields({ source: "native", capturedFields }),
    }).toEqual({
      displayName: "Reviewed merchant",
      amount: 19,
      currency: "GBP",
      date: "2026-09-02",
    });
  });

  test("preserves explicitly cleared values and valid partial review data", () => {
    expect(
      reviewedReceiptFields({
        source: "native",
        capturedFields: { displayName: "Merchant", currency: "GBP", amount: null, date: null },
      }),
    ).toEqual({ displayName: "Merchant", currency: "GBP", amount: null, date: null });
    expect(
      reviewedReceiptFields({
        source: "native",
        capturedFields: { displayName: "Merchant", currency: "GBP" },
      }),
    ).toEqual({ displayName: "Merchant", currency: "GBP" });
  });

  test("does not override extraction for unrelated or malformed metadata", () => {
    expect(
      reviewedReceiptFields({
        source: "email",
        capturedFields: { displayName: "Other", currency: "GBP" },
      }),
    ).toEqual({});
    expect(
      reviewedReceiptFields({
        source: "native",
        capturedFields: { displayName: "", currency: "???", amount: Infinity },
      }),
    ).toEqual({});
    expect(reviewedReceiptFields(null)).toEqual({});
  });
});
