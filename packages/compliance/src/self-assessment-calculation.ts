import type { SelfAssessmentReport } from "./self-assessment";

/** Shared arithmetic for a draft illustration and the strictly validated filing route. */
export function calculateSelfAssessmentAmounts(
  report: SelfAssessmentReport,
  taxpayerStatus: "U" | "C" | "S",
) {
  const groups = report.groups.map((g) => ({
    ...g,
    wholePounds:
      g.kind === "income" ? Math.floor(g.amountPence / 100) : Math.ceil(g.amountPence / 100),
  }));
  const income = groups.filter((g) => g.kind === "income").reduce((n, g) => n + g.wholePounds, 0);
  const expenses = groups
    .filter((g) => g.kind === "expense")
    .reduce((n, g) => n + g.wholePounds, 0);
  const profit = income - expenses;
  // 2025/26 rates. Only this business, full personal allowance, no adjustments, income < £90,000.
  const taxable = Math.max(0, profit - 12570);
  const bands =
    taxpayerStatus === "S"
      ? [
          { to: 2827, rate: 19 },
          { to: 14921, rate: 20 },
          { to: 31092, rate: 21 },
          { to: 62430, rate: 42 },
          { to: 112570, rate: 45 },
        ]
      : [
          { to: 37700, rate: 20 },
          { to: 112570, rate: 40 },
        ];
  let previous = 0;
  let incomeTaxPence = 0;
  for (const band of bands) {
    incomeTaxPence += Math.max(0, Math.min(taxable, band.to) - previous) * band.rate;
    previous = band.to;
  }
  const class4Pence =
    Math.max(0, Math.min(profit, 50270) - 12570) * 6 + Math.max(0, profit - 50270) * 2;
  const taxBeforeCisPence = incomeTaxPence + class4Pence;
  // HMRC rounds tax paid up once at the return-box total, never per payment.
  const cisDeductionsPence = Math.ceil(report.cisDeductionsPence / 100) * 100;
  const totalTaxPence = taxBeforeCisPence - cisDeductionsPence;
  return {
    groups,
    incomePounds: income,
    expensesPounds: expenses,
    profitPounds: profit,
    personalAllowancePounds: Math.min(12570, profit),
    incomeTaxPence,
    class4Pence,
    class2Pence: 0,
    taxBeforeCisPence,
    cisDeductionsPence,
    totalTaxPence,
    taxDuePence: Math.max(0, totalTaxPence),
    refundPence: Math.max(0, -totalTaxPence),
    includesPaymentsOnAccount: false as const,
  };
}

export function calculateSelfAssessmentDraft(
  report: SelfAssessmentReport,
  taxpayerStatus: "U" | "C" | "S",
) {
  if (
    report.taxYear !== 2025 ||
    report.incomePence >= 9_000_000 ||
    report.profitPence < 0 ||
    report.groups.some((g) => g.amountPence < 0)
  )
    return null;
  const result = calculateSelfAssessmentAmounts(report, taxpayerStatus);
  return result.profitPounds < 0 ? null : result;
}
