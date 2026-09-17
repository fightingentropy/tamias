import { describe, expect, test } from "bun:test";
import {
  buildSelfAssessmentReport,
  businessShare,
  poundsToPence,
  SelfAssessmentProfileSchema,
  selfAssessmentCSV,
  taxSourceVersion,
  taxYearDates,
  type TaxSourceTransaction,
  type TaxReview,
  CisPaymentSchema,
} from "./self-assessment";

const profile = SelfAssessmentProfileSchema.parse({
  businessName: "Example",
  businessDescription: "Design",
  soleTrader: true,
  cashBasis: true,
  recordsComplete: true,
  adjustmentsReviewed: true,
  otherIncomeReviewed: true,
});
function row(
  id: string,
  amount: number,
  overrides: Partial<TaxSourceTransaction> = {},
): TaxSourceTransaction {
  return {
    id,
    name: id,
    amount,
    currency: "GBP",
    date: "2025-05-01",
    baseAmount: null,
    baseCurrency: null,
    status: "posted",
    internal: false,
    hasReceipt: true,
    updatedAt: "2025-05-02",
    ...overrides,
  };
}
function review(
  t: TaxSourceTransaction,
  category: TaxReview["category"],
  businessPercent = 100,
): TaxReview {
  return {
    transactionId: t.id,
    sourceVersion: taxSourceVersion(t),
    category,
    businessPercent,
    note: "",
  };
}
function report(transactions: TaxSourceTransaction[], reviews: TaxReview[] = []) {
  return buildSelfAssessmentReport({
    taxYear: 2025,
    transactions,
    reviews,
    profile,
    now: new Date("2026-09-08"),
  });
}
describe("sole-trader working papers", () => {
  test("uses statement gross income and keeps CIS credit out of expenses", () => {
    const t = row("cis", 800, { isCis: true });
    const cis = {
      grossPence: 100000,
      deductionPence: 20000,
      incomeTaxYear: 2025,
      deductionTaxYear: 2025,
      taxYearsUnderReview: [],
      reference: "Contractor monthly statement",
    };
    const result = report([t], [{ ...review(t, "turnover"), cis }]);
    expect(result).toMatchObject({
      incomePence: 100000,
      expensesPence: 0,
      cisDeductionsPence: 20000,
      needsReview: 0,
    });
    expect(result.transactions[0]).toMatchObject({
      amountPence: 80000,
      businessAmountPence: 100000,
    });
    expect(selfAssessmentCSV(result)).toContain('"CIS tax deducted GBP (SA103S box 38)","200.00"');
  });
  test("never accepts a known net CIS receipt without valid matching statement figures", () => {
    const t = row("cis", 800, { isCis: true });
    expect(report([t], [review(t, "turnover")])).toMatchObject({ incomePence: 0, needsReview: 1 });
    const cis = {
      grossPence: 100001,
      deductionPence: 20000,
      incomeTaxYear: 2025,
      deductionTaxYear: 2025,
      taxYearsUnderReview: [],
      reference: "Mismatch",
    };
    expect(report([t], [{ ...review(t, "turnover"), cis }])).toMatchObject({
      incomePence: 0,
      cisDeductionsPence: 0,
      needsReview: 1,
    });
    expect(report([t], [review(t, "excluded", 0)])).toMatchObject({
      incomePence: 0,
      needsReview: 0,
    });
  });
  test("allocates income and CIS credit to different years without counting either twice", () => {
    const t = row("cis", 800, { date: "2026-04-08", isCis: true });
    const cis = {
      grossPence: 100000,
      deductionPence: 20000,
      incomeTaxYear: 2026,
      deductionTaxYear: 2025,
      taxYearsUnderReview: [],
      reference: "Confirmed payment and deduction years",
    };
    const reviews = [{ ...review(t, "turnover"), cis }];
    expect(report([t], reviews)).toMatchObject({ incomePence: 0, cisDeductionsPence: 20000 });
    const next = buildSelfAssessmentReport({ taxYear: 2026, transactions: [t], reviews, profile });
    expect(next).toMatchObject({ incomePence: 100000, cisDeductionsPence: 0 });
  });
  test("keeps unallocated gross income and deductions visible in both affected years", () => {
    const t = row("boundary", 560, { date: "2025-04-09", isCis: true });
    const cis = {
      grossPence: 70000,
      deductionPence: 14000,
      incomeTaxYear: null,
      deductionTaxYear: null,
      taxYearsUnderReview: [2024, 2025],
      reference: "Contractor confirmation requested",
    };
    const reviews = [{ ...review(t, "turnover"), cis }];
    for (const taxYear of [2024, 2025]) {
      const result = buildSelfAssessmentReport({ taxYear, transactions: [t], reviews, profile });
      expect(result).toMatchObject({
        incomePence: 0,
        cisDeductionsPence: 0,
        cisPendingGrossPence: 70000,
        cisPendingDeductionsPence: 14000,
        cisPendingCount: 1,
        readyToExport: false,
      });
    }
    const changed = report([{ ...t, amount: 600 }], reviews);
    expect(changed.needsReview).toBe(1);
    expect(changed.cisDeductionsPence).toBe(0);
  });
  test("requires evidence and explicit affected years for unresolved CIS", () => {
    const value = {
      grossPence: 70000,
      deductionPence: 14000,
      incomeTaxYear: null,
      deductionTaxYear: null,
      taxYearsUnderReview: [],
      reference: "Statement",
    };
    expect(CisPaymentSchema.safeParse(value).success).toBe(false);
    expect(
      CisPaymentSchema.safeParse({ ...value, taxYearsUnderReview: [2024, 2025] }).success,
    ).toBe(true);
    expect(
      CisPaymentSchema.safeParse({
        ...value,
        incomeTaxYear: 2025,
        deductionTaxYear: 2025,
        reference: "",
      }).success,
    ).toBe(false);
  });
  test("closes the tax year at UK midnight, including daylight saving", () => {
    const before = buildSelfAssessmentReport({
      taxYear: 2025,
      transactions: [],
      reviews: [],
      profile,
      now: new Date("2026-04-05T22:59:59Z"),
    });
    const after = buildSelfAssessmentReport({
      taxYear: 2025,
      transactions: [],
      reviews: [],
      profile,
      now: new Date("2026-04-05T23:00:00Z"),
    });
    expect(before.blockers).toContain("This tax year has not ended yet.");
    expect(after.blockers).not.toContain("This tax year has not ended yet.");
  });
  test("uses the UK tax year, including April 5 and excluding April 6 of the next year", () => {
    expect(taxYearDates(2025)).toMatchObject({
      start: "2025-04-06",
      end: "2026-04-05",
      deadline: "2027-01-31",
    });
    const rows = [
      row("before", 1, { date: "2025-04-05" }),
      row("first", 2, { date: "2025-04-06" }),
      row("last", 3, { date: "2026-04-05T23:59:59Z" }),
      row("after", 4, { date: "2026-04-06" }),
    ];
    const result = report(
      rows,
      rows.map((r) => review(r, "turnover")),
    );
    expect(result.transactions.map((t) => t.id)).toEqual(["first", "last"]);
    expect(result.incomePence).toBe(500);
  });
  test("only totals reviewed business items, while refunds reverse their original category", () => {
    const rows = [
      row("sale", 1000),
      row("sales-refund", -100),
      row("cost", -100.01),
      row("cost-refund", 20),
      row("unknown", 9000),
      row("personal", -500),
      row("transfer", 10000, { internal: true }),
      row("pending", 20, { status: "pending" }),
    ];
    const result = report(rows, [
      review(rows[0]!, "turnover"),
      review(rows[1]!, "turnover"),
      review(rows[2]!, "office", 50),
      review(rows[3]!, "office", 50),
      review(rows[5]!, "excluded"),
      review(rows[6]!, "turnover"),
      review(rows[7]!, "turnover"),
    ]);
    expect(result.incomePence).toBe(90000);
    expect(result.expensesPence).toBe(4001);
    expect(result.profitPence).toBe(85999);
    expect(result.needsReview).toBe(1);
    expect(result.pending).toBe(1);
    expect(result.readyToExport).toBe(false);
  });
  test("reopens review after a financial change even if updated_at did not advance", () => {
    const original = row("one", -100);
    const result = report([{ ...original, amount: -1000 }], [review(original, "office")]);
    expect(result.expensesPence).toBe(0);
    expect(result.transactions[0]?.changedSinceReview).toBe(true);
    expect(result.needsReview).toBe(1);
  });
  test("never adds different currencies; uses a recorded GBP conversion when available", () => {
    const rows = [
      row("eur", -50, { currency: "EUR" }),
      row("usd", -100, { currency: "USD", baseCurrency: "GBP", baseAmount: -75 }),
    ];
    const result = report(
      rows,
      rows.map((r) => review(r, "office")),
    );
    expect(result.expensesPence).toBe(7500);
    expect(result.missingCurrency).toBe(1);
    expect(result.readyToExport).toBe(false);
  });
  test("supports zero business use without claiming private expenditure", () => {
    const t = row("phone", -40);
    expect(report([t], [review(t, "office", 0)]).expensesPence).toBe(0);
  });
  test("rounds half pennies symmetrically and rejects invalid money", () => {
    expect(poundsToPence(1.005)).toBe(101);
    expect(poundsToPence(-1.005)).toBe(-101);
    expect(businessShare(10001, 50)).toBe(5001);
    expect(businessShare(-10001, 50)).toBe(-5001);
    expect(() => poundsToPence(Infinity)).toThrow();
  });
  test("separates working papers from unsupported filing circumstances", () => {
    const t = row("sales", 90000);
    const result = report([t], [review(t, "turnover")]);
    expect(result.readyToExport).toBe(true);
    expect(result.filingBlockers.join(" ")).toContain("full self-employment");
    const extra = buildSelfAssessmentReport({
      taxYear: 2025,
      transactions: [],
      reviews: [],
      profile: { ...profile, additionalSections: ["employment"] },
      now: new Date("2026-09-08"),
    });
    expect(extra.filingBlockers.join(" ")).toContain("additional sections");
  });
  test("exports every source row, draft checks and formula-safe text", () => {
    const t = row("csv", -12, { name: '=HYPERLINK("https://invalid.test")' });
    const csv = selfAssessmentCSV(report([t]));
    expect(csv).toContain("Draft - review items remain");
    expect(csv).toContain("\"'=HYPERLINK");
    expect(csv).toContain("Unreviewed");
    expect(csv).toContain('"-12.00"');
    expect(csv).not.toContain("'-12");
    expect(csv).toContain("\r\n");
  });
});
