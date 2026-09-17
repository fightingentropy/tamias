import { z } from "zod";

// These are the SA103S expense groups, not VAT rates or the company's CT ledger.
export const selfAssessmentCategories = [
  { id: "turnover", name: "Sales", box: "9", kind: "income" },
  { id: "other_income", name: "Other business income", box: "10", kind: "income" },
  { id: "goods", name: "Goods and materials", box: "11", kind: "expense" },
  { id: "travel", name: "Car and travel", box: "12", kind: "expense" },
  { id: "staff", name: "Staff costs", box: "13", kind: "expense" },
  { id: "premises", name: "Rent, utilities and insurance", box: "14", kind: "expense" },
  { id: "repairs", name: "Repairs and maintenance", box: "15", kind: "expense" },
  { id: "professional", name: "Accountancy and legal fees", box: "16", kind: "expense" },
  { id: "finance", name: "Interest and bank charges", box: "17", kind: "expense" },
  { id: "office", name: "Phone, stationery and office", box: "18", kind: "expense" },
  { id: "other_expenses", name: "Other allowable expenses", box: "19", kind: "expense" },
  { id: "excluded", name: "Personal, transfer or not allowable", box: "", kind: "excluded" },
] as const;
export const SelfAssessmentCategorySchema = z.enum([
  "turnover",
  "other_income",
  "goods",
  "travel",
  "staff",
  "premises",
  "repairs",
  "professional",
  "finance",
  "office",
  "other_expenses",
  "excluded",
]);
export type SelfAssessmentCategory = z.infer<typeof SelfAssessmentCategorySchema>;
export const TaxYearSchema = z.coerce.number().int().min(2024).max(2098);
export const SelfAssessmentProfileSchema = z.object({
  businessName: z.string().trim().max(100).default(""),
  businessDescription: z.string().trim().max(200).default(""),
  soleTrader: z.boolean().default(false),
  cashBasis: z.boolean().default(false),
  recordsComplete: z.boolean().default(false),
  adjustmentsReviewed: z.boolean().default(false),
  otherIncomeReviewed: z.boolean().default(false),
  additionalSections: z
    .array(
      z.enum([
        "employment",
        "property",
        "savings_dividends",
        "capital_gains",
        "foreign",
        "partnership",
        "pensions_benefits",
        "student_loans",
        "reliefs",
        "multiple_businesses",
        "vat_registered",
        "capital_allowances",
        "loss_relief",
        "non_resident",
        "mtd",
      ]),
    )
    .max(15)
    .default([]),
});
export type SelfAssessmentProfile = z.infer<typeof SelfAssessmentProfileSchema>;
// A bank credit is net of CIS. Keep the original amount and allocate the statement's
// gross income and tax credit independently; neither year is inferred from the other.
export const CisPaymentSchema = z
  .object({
    grossPence: z.number().int().positive().max(100_000_000_000),
    deductionPence: z.number().int().min(0).max(100_000_000_000),
    incomeTaxYear: TaxYearSchema.nullable(),
    deductionTaxYear: TaxYearSchema.nullable(),
    taxYearsUnderReview: z.array(TaxYearSchema).max(3).default([]),
    reference: z.string().trim().min(1).max(500),
  })
  .superRefine((value, context) => {
    if (value.deductionPence >= value.grossPence)
      context.addIssue({ code: "custom", message: "CIS deductions must be less than gross pay." });
    const pending = value.incomeTaxYear === null || value.deductionTaxYear === null;
    if (pending !== value.taxYearsUnderReview.length > 0)
      context.addIssue({
        code: "custom",
        message: "List the tax years awaiting confirmation, or assign both tax years.",
      });
    if (new Set(value.taxYearsUnderReview).size !== value.taxYearsUnderReview.length)
      context.addIssue({ code: "custom", message: "Choose each tax year only once." });
  });
export type CisPayment = z.infer<typeof CisPaymentSchema>;
export const TaxReviewSchema = z.object({
  transactionId: z.string().min(1).max(100),
  sourceVersion: z.string().min(1).max(2000),
  category: SelfAssessmentCategorySchema,
  businessPercent: z.number().int().min(0).max(100),
  note: z.string().trim().max(500).default(""),
  // Omitted by older clients means preserve; explicit null removes the statement.
  cis: CisPaymentSchema.nullable().optional(),
});
export const TaxReviewBatchSchema = z.object({ reviews: z.array(TaxReviewSchema).min(1).max(100) });
export type TaxReview = z.infer<typeof TaxReviewSchema>;

export function taxYearDates(startYear: number) {
  TaxYearSchema.parse(startYear);
  return {
    start: `${startYear}-04-06`,
    end: `${startYear + 1}-04-05`,
    endExclusive: `${startYear + 1}-04-06`,
    label: `${startYear}/${String(startYear + 1).slice(-2)}`,
    deadline: `${startYear + 2}-01-31`,
  };
}

export type TaxSourceTransaction = {
  id: string;
  name: string;
  date: string;
  amount: number;
  currency: string;
  baseAmount: number | null;
  baseCurrency: string | null;
  status: string;
  internal: boolean;
  hasReceipt: boolean;
  updatedAt: string;
  isCis?: boolean;
};
export function transactionTaxYear(date: string) {
  const year = Number(date.slice(0, 4));
  return date.slice(5, 10) < "04-06" ? year - 1 : year;
}
export function cisRelatesToYear(cis: CisPayment | null | undefined, year: number) {
  return Boolean(
    cis &&
    (cis.incomeTaxYear === year ||
      cis.deductionTaxYear === year ||
      cis.taxYearsUnderReview.includes(year)),
  );
}
export function taxSourceVersion(row: TaxSourceTransaction): string {
  // Include tax-relevant values even when an importer fails to advance updated_at.
  return JSON.stringify([
    row.date,
    row.amount,
    row.currency,
    row.baseAmount,
    row.baseCurrency,
    row.status,
    row.internal,
    row.updatedAt,
  ]);
}

export function poundsToPence(amount: number): number {
  if (!Number.isFinite(amount) || Math.abs(amount) > 1_000_000_000)
    throw new Error("Amount is outside the supported range");
  // Avoid binary floating-point arithmetic for sums and business-use apportionment.
  const negative = amount < 0;
  const [whole, fraction = ""] = Math.abs(amount).toFixed(8).split(".");
  let value = Number(whole) * 100 + Number(fraction.slice(0, 2));
  if (Number(fraction[2] ?? "0") >= 5) value++;
  return negative ? -value : value;
}
export function businessShare(pence: number, percent: number) {
  if (!Number.isSafeInteger(pence) || !Number.isInteger(percent) || percent < 0 || percent > 100)
    throw new Error("Invalid business share");
  const result = (BigInt(Math.abs(pence)) * BigInt(percent) + 50n) / 100n;
  return Number(result) * (pence < 0 ? -1 : 1);
}

export function buildSelfAssessmentReport(args: {
  taxYear: number;
  transactions: TaxSourceTransaction[];
  reviews: TaxReview[];
  profile: SelfAssessmentProfile;
  now?: Date;
}) {
  const dates = taxYearDates(args.taxYear);
  const sources = new Map(args.transactions.map((row) => [row.id, row]));
  const reviews = new Map<string, TaxReview>();
  for (const row of args.reviews) {
    const source = sources.get(row.transactionId);
    const existing = reviews.get(row.transactionId);
    // A corrected bank date can leave a historical review under its old year.
    // Prefer the review of today's source, never let old CIS credit reappear.
    if (!existing || !source || existing.sourceVersion !== taxSourceVersion(source))
      reviews.set(row.transactionId, row);
  }
  const groups = selfAssessmentCategories
    .filter((c) => c.kind !== "excluded")
    .map((c) => ({ ...c, amountPence: 0 }));
  const transactions = args.transactions
    .filter(
      (t) =>
        transactionTaxYear(t.date) === args.taxYear ||
        cisRelatesToYear(reviews.get(t.id)?.cis, args.taxYear),
    )
    .map((row) => {
      const saved = reviews.get(row.id);
      const sourceVersion = taxSourceVersion(row);
      const automaticExclusion = row.internal || ["excluded", "archived"].includes(row.status);
      const review = saved?.sourceVersion === sourceVersion ? saved : null;
      const pending = row.status === "pending";
      const gbp =
        row.currency.toUpperCase() === "GBP"
          ? row.amount
          : row.baseCurrency?.toUpperCase() === "GBP"
            ? row.baseAmount
            : null;
      const category = automaticExclusion ? "excluded" : (review?.category ?? null);
      const businessPercent =
        automaticExclusion || category === "excluded" ? 0 : (review?.businessPercent ?? 100);
      const amountPence = gbp !== null ? poundsToPence(gbp) : null;
      const cis = saved?.cis ?? null;
      const cisValid = Boolean(
        review?.cis &&
        category === "turnover" &&
        businessPercent === 100 &&
        row.currency.toUpperCase() === "GBP" &&
        amountPence !== null &&
        amountPence > 0 &&
        review.cis.grossPence - review.cis.deductionPence === amountPence,
      );
      const cisMissing = Boolean(row.isCis && category !== "excluded" && !cis);
      const cisPending = Boolean(cis?.taxYearsUnderReview.includes(args.taxYear));
      const blockedCurrency =
        !automaticExclusion && category !== "excluded" && amountPence === null;
      const needsReview =
        !automaticExclusion && !pending && (!review || cisMissing || Boolean(cis && !cisValid));
      const included =
        !pending &&
        !needsReview &&
        !blockedCurrency &&
        category !== "excluded" &&
        category !== null;
      const share =
        !included || amountPence === null
          ? 0
          : cis
            ? cis.incomeTaxYear === args.taxYear
              ? cis.grossPence
              : 0
            : businessShare(amountPence, businessPercent);
      const cisDeductionPence =
        included && cis?.deductionTaxYear === args.taxYear ? cis.deductionPence : 0;
      const group = groups.find((g) => g.id === category);
      if (included && group) group.amountPence += group.kind === "income" ? share : -share;
      return {
        id: row.id,
        name: row.name,
        date: row.date.slice(0, 10),
        amount: row.amount,
        currency: row.currency,
        amountPence,
        sourceVersion,
        category,
        businessPercent,
        note: review?.note ?? "",
        hasReceipt: row.hasReceipt,
        needsReview,
        changedSinceReview: Boolean(saved && !review),
        pending,
        blockedCurrency,
        included,
        businessAmountPence: share,
        automaticExclusion,
        bankTaxYear: transactionTaxYear(row.date),
        isCis: Boolean(row.isCis || cis),
        cis,
        cisMissing,
        cisPending,
        cisDeductionPence,
      };
    });
  const incomePence = groups
    .filter((g) => g.kind === "income")
    .reduce((n, g) => n + g.amountPence, 0);
  const expensesPence = groups
    .filter((g) => g.kind === "expense")
    .reduce((n, g) => n + g.amountPence, 0);
  const cisDeductionsPence = transactions.reduce((sum, t) => sum + t.cisDeductionPence, 0);
  const cisPendingGrossPence = transactions.reduce(
    (sum, t) => sum + (t.cisPending && t.cis?.incomeTaxYear === null ? t.cis.grossPence : 0),
    0,
  );
  const cisPendingDeductionsPence = transactions.reduce(
    (sum, t) => sum + (t.cisPending && t.cis?.deductionTaxYear === null ? t.cis.deductionPence : 0),
    0,
  );
  const cisPendingCount = transactions.filter((t) => t.cisPending).length;
  if (
    ![
      incomePence,
      expensesPence,
      cisDeductionsPence,
      cisPendingGrossPence,
      cisPendingDeductionsPence,
    ].every(Number.isSafeInteger)
  )
    throw new Error("Tax totals exceed the supported range");
  const needsReview = transactions.filter((t) => t.needsReview).length;
  const missingCurrency = transactions.filter((t) => t.blockedCurrency).length;
  const pending = transactions.filter((t) => t.pending).length;
  const missingReceipts = transactions.filter(
    (t) => t.included && t.businessAmountPence < 0 && !t.hasReceipt,
  ).length;
  const blockers: string[] = [];
  if (!args.profile.soleTrader)
    blockers.push("Confirm this workspace is for your sole-trader business.");
  if (!args.profile.cashBasis)
    blockers.push("Confirm cash-basis accounting. These totals use money received and paid.");
  if (!args.profile.businessName || !args.profile.businessDescription)
    blockers.push("Add your business name and description.");
  if (needsReview)
    blockers.push(`Review ${needsReview} transaction${needsReview === 1 ? "" : "s"}.`);
  if (cisPendingCount)
    blockers.push(
      `Confirm the tax year for ${cisPendingCount} CIS payment${cisPendingCount === 1 ? "" : "s"}. Unallocated income and deductions are not included in totals.`,
    );
  if (missingCurrency)
    blockers.push(
      `Add a GBP conversion or exclude ${missingCurrency} foreign-currency transaction${missingCurrency === 1 ? "" : "s"}.`,
    );
  if (pending)
    blockers.push(
      `${pending} pending transaction${pending === 1 ? " has" : "s have"} not settled.`,
    );
  if (!args.profile.recordsComplete)
    blockers.push("Confirm all business accounts, cash income and expenses are included.");
  if (!args.profile.adjustmentsReviewed)
    blockers.push("Review adjustments, allowances and losses.");
  if (!args.profile.otherIncomeReviewed)
    blockers.push("Check the other sections needed for your personal return.");
  const now = args.now ?? new Date();
  const ukParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const ukToday = ["year", "month", "day"]
    .map((type) => ukParts.find((part) => part.type === type)!.value)
    .join("-");
  if (ukToday < dates.endExclusive) blockers.push("This tax year has not ended yet.");
  const filingBlockers = [...blockers];
  if (args.taxYear !== 2025)
    filingBlockers.push("Direct Self Assessment filing currently supports 2025/26 only.");
  if (incomePence >= 9_000_000)
    filingBlockers.push("Turnover of £90,000 or more needs the full self-employment pages.");
  if (groups.some((g) => g.amountPence < 0))
    filingBlockers.push("A category has net refunds. Review its treatment before filing.");
  if (incomePence < expensesPence)
    filingBlockers.push("A business loss needs a loss-relief review before filing.");
  if (args.profile.additionalSections.length)
    filingBlockers.push(
      "Your return needs additional sections. Include them using HMRC or your accountant.",
    );
  return {
    taxYear: args.taxYear,
    ...dates,
    generatedAt: now.toISOString(),
    currency: "GBP",
    profile: args.profile,
    categories: selfAssessmentCategories.map((category) => ({ ...category })),
    groups,
    transactions,
    incomePence,
    expensesPence,
    profitPence: incomePence - expensesPence,
    cisDeductionsPence,
    cisPendingGrossPence,
    cisPendingDeductionsPence,
    cisPendingCount,
    needsReview,
    missingCurrency,
    pending,
    missingReceipts,
    blockers,
    filingBlockers,
    readyToExport: blockers.length === 0,
  };
}
export type SelfAssessmentReport = ReturnType<typeof buildSelfAssessmentReport>;

function csvCell(value: unknown) {
  let text = String(value ?? "");
  // Signed decimal amounts remain numeric when imported. Escape formula-like text,
  // including names and notes that start with a spreadsheet operator.
  if (/^[\s]*[=+@-]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function selfAssessmentCSV(report: SelfAssessmentReport) {
  const rows: unknown[][] = [
    ["Tamias Self Assessment working papers", report.label],
    [
      "Status",
      report.readyToExport
        ? "Business figures reviewed; personal return still requires completion"
        : "Draft - review items remain",
    ],
    ["Accounting basis", "Cash basis; GBP; reviewed business transactions only"],
    ["Business", report.profile.businessName],
    ["Income GBP", (report.incomePence / 100).toFixed(2)],
    ["Allowable expenses GBP", (report.expensesPence / 100).toFixed(2)],
    ["Profit before further tax adjustments GBP", (report.profitPence / 100).toFixed(2)],
    ["CIS tax deducted GBP (SA103S box 38)", (report.cisDeductionsPence / 100).toFixed(2)],
    [
      "CIS gross income awaiting tax-year confirmation GBP (not included)",
      (report.cisPendingGrossPence / 100).toFixed(2),
    ],
    [
      "CIS deductions awaiting tax-year confirmation GBP (not included)",
      (report.cisPendingDeductionsPence / 100).toFixed(2),
    ],
    [],
    ["SA103S box", "Category", "GBP (unrounded working figure)"],
    ...report.groups.map((g) => [g.box, g.name, (g.amountPence / 100).toFixed(2)]),
    [],
    ["Review items"],
    ...report.blockers.map((b) => [b]),
    ["Missing receipts", report.missingReceipts],
    ["Additional personal return sections", report.profile.additionalSections.join(", ")],
    [],
    [
      "Date",
      "Transaction",
      "Original amount",
      "Currency",
      "GBP",
      "Tax category",
      "Business %",
      "Business GBP (signed)",
      "Included",
      "Needs review",
      "Receipt",
      "Note",
      "ID",
      "CIS gross GBP",
      "CIS deducted GBP",
      "CIS income tax year",
      "CIS deduction tax year",
      "CIS years awaiting confirmation",
      "CIS statement reference",
    ],
    ...report.transactions.map((t) => [
      t.date,
      t.name,
      t.amount,
      t.currency,
      t.amountPence === null ? "" : (t.amountPence / 100).toFixed(2),
      t.category ?? "Unreviewed",
      t.businessPercent,
      (t.businessAmountPence / 100).toFixed(2),
      t.included,
      t.needsReview,
      t.hasReceipt,
      t.note,
      t.id,
      t.cis ? (t.cis.grossPence / 100).toFixed(2) : "",
      t.cis ? (t.cis.deductionPence / 100).toFixed(2) : "",
      t.cis?.incomeTaxYear ?? "",
      t.cis?.deductionTaxYear ?? "",
      t.cis?.taxYearsUnderReview.join(", ") ?? "",
      t.cis?.reference ?? "",
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
