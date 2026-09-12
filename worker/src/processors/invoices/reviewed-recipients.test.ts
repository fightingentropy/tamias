import { describe, expect, test } from "bun:test";
import { generateInvoiceSchema, sendInvoiceEmailSchema } from "../../schemas/invoices";
import { assertReviewedRecipients } from "./reviewed-recipients";

const expected = {
  expectedCustomerEmail: "client@example.com",
  expectedBillingEmails: ["accounts@example.com"],
};

describe("reviewed invoice delivery recipients", () => {
  test("guards the actual customer and every billing copy", () => {
    expect(() =>
      assertReviewedRecipients(expected, "CLIENT@example.com", [" accounts@example.com "]),
    ).not.toThrow();
    expect(() =>
      assertReviewedRecipients(expected, "new@example.com", ["accounts@example.com"]),
    ).toThrow("changed after review");
    expect(() =>
      assertReviewedRecipients(expected, "client@example.com", [
        "accounts@example.com",
        "owner@example.com",
      ]),
    ).toThrow("changed after review");
    expect(() => assertReviewedRecipients(expected, "client@example.com", [])).toThrow(
      "changed after review",
    );
  });

  test("fails closed when only one expectation reaches the worker", () => {
    expect(() =>
      assertReviewedRecipients(
        { expectedCustomerEmail: expected.expectedCustomerEmail },
        "client@example.com",
        [],
      ),
    ).toThrow();
    expect(() =>
      assertReviewedRecipients({ expectedBillingEmails: [] }, "client@example.com", []),
    ).toThrow();
  });

  test("normalizes duplicate billing addresses and preserves existing non-reviewed flows", () => {
    expect(() =>
      assertReviewedRecipients(expected, "client@example.com", [
        "accounts@example.com",
        "ACCOUNTS@example.com",
      ]),
    ).not.toThrow();
    expect(() =>
      assertReviewedRecipients({}, "client@example.com", ["legacy@example.com"]),
    ).not.toThrow();
  });

  test("queue schemas retain reviewed recipients through generation and delivery", () => {
    const generated = generateInvoiceSchema.parse({
      invoiceId: "00000000-0000-4000-8000-000000000001",
      deliveryType: "create_and_send",
      ...expected,
    });
    const sent = sendInvoiceEmailSchema.parse({
      ...generated,
      filename: "invoice.pdf",
      fullPath: "team/invoice.pdf",
    });
    expect(sent.expectedCustomerEmail).toBe(expected.expectedCustomerEmail);
    expect(sent.expectedBillingEmails).toEqual(expected.expectedBillingEmails);
  });
});
