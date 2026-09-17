import { writeFileSync } from "node:fs";
import {
  buildSelfAssessmentReport,
  SelfAssessmentProfileSchema,
  taxSourceVersion,
  poundsToPence,
  type TaxSourceTransaction,
} from "../packages/compliance/src/self-assessment";
import {
  buildSelfAssessmentBody,
  type SelfAssessmentIdentity,
} from "../packages/compliance/src/self-assessment-filing";
import { buildHmrcSaEnvelope } from "../packages/compliance/src/providers/hmrc-self-assessment";

// Synthetic data only. No account credentials or personal tax records belong in fixtures.
const transactions: TaxSourceTransaction[] = [
  {
    id: "income",
    amount: 40000.89,
    name: "Example income",
    currency: "GBP",
    date: "2025-08-01",
    baseAmount: null,
    baseCurrency: null,
    status: "posted",
    internal: false,
    hasReceipt: true,
    updatedAt: "2026-01-01",
  },
  {
    id: "expense",
    amount: -345.12,
    name: "Example expense",
    currency: "GBP",
    date: "2025-08-01",
    baseAmount: null,
    baseCurrency: null,
    status: "posted",
    internal: false,
    hasReceipt: true,
    updatedAt: "2026-01-01",
  },
];
const report = buildSelfAssessmentReport({
  taxYear: 2025,
  transactions,
  now: new Date("2026-09-01"),
  reviews: transactions.map((t) => ({
    transactionId: t.id,
    sourceVersion: taxSourceVersion(t),
    category: t.amount > 0 ? "turnover" : "office",
    businessPercent: 100,
    note: "",
  })),
  profile: SelfAssessmentProfileSchema.parse({
    businessName: "Example Studio",
    businessDescription: "Design & print",
    soleTrader: true,
    cashBasis: true,
    recordsComplete: true,
    adjustmentsReviewed: true,
    otherIncomeReviewed: true,
  }),
});
const identity: SelfAssessmentIdentity = {
  fullName: "Example Taxpayer",
  utr: "1234567890",
  nino: "AB123456C",
  dateOfBirth: "1990-01-01",
  taxpayerStatus: "U",
  onlyThisBusinessIncome: true,
  standardPersonalAllowance: true,
  noOtherChargesOrReliefs: true,
  businessOperatedFullYear: true,
  standardNationalInsurance: true,
  class2Choice: "not_needed",
};
export function createSelfAssessmentFixture(utr = identity.utr) {
  const testIdentity = { ...identity, utr };
  return { report, identity: testIdentity, ...buildSelfAssessmentBody(report, testIdentity) };
}

export function createCisSelfAssessmentFixture(
  utr = identity.utr,
  gross = 40000.89,
  deduction = 8000.18,
) {
  const grossPence = poundsToPence(gross);
  const deductionPence = poundsToPence(deduction);
  const sources = transactions.map((t) =>
    t.id === "income" ? { ...t, amount: (grossPence - deductionPence) / 100, isCis: true } : t,
  );
  const cisReport = buildSelfAssessmentReport({
    taxYear: 2025,
    transactions: sources,
    profile: report.profile,
    now: new Date("2026-09-01"),
    reviews: sources.map((t) => ({
      transactionId: t.id,
      sourceVersion: taxSourceVersion(t),
      category: t.id === "income" ? "turnover" : "office",
      businessPercent: 100,
      note: "Fictional CIS fixture",
      cis:
        t.id === "income"
          ? {
              grossPence,
              deductionPence,
              incomeTaxYear: 2025,
              deductionTaxYear: 2025,
              taxYearsUnderReview: [],
              reference: "Fictional contractor statement",
            }
          : null,
    })),
  });
  const testIdentity = { ...identity, utr };
  return {
    report: cisReport,
    identity: testIdentity,
    ...buildSelfAssessmentBody(cisReport, testIdentity),
  };
}

if (import.meta.main) {
  const body =
    process.argv[3] === "cis-refund"
      ? createCisSelfAssessmentFixture()
      : process.argv[3] === "cis-due"
        ? createCisSelfAssessmentFixture(identity.utr, 80000, 16000)
        : createSelfAssessmentFixture();
  writeFileSync(
    process.argv[2] ?? "/tmp/tamias-sa-fixture.xml",
    buildHmrcSaEnvelope({
      bodyXml: body.bodyXml,
      utr: body.identity.utr,
      senderId: "fixture",
      password: "fixture",
      vendorId: "1234",
      environment: "test",
    }),
  );
}
