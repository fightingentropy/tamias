import { createHash } from "node:crypto";
import { z } from "zod";
import type { SelfAssessmentReport } from "./self-assessment";

export const SA_2026_NAMESPACE = "http://www.govtalk.gov.uk/taxation/SA/SA100/25-26/1";
export const GOVTALK_NAMESPACE = "http://www.govtalk.gov.uk/CM/envelope";
const hmrcText = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9 &'()*,\-./@£]+$/,
    "Use the characters accepted by HMRC (letters, numbers and basic punctuation).",
  );
export const SelfAssessmentIdentitySchema = z.object({
  fullName: hmrcText.min(1).max(56),
  utr: z.string().regex(/^\d{10}$/),
  nino: z.string().regex(/^[A-Z]{2}\d{6}[A-D]$/),
  dateOfBirth: z.iso.date(),
  taxpayerStatus: z.enum(["U", "C", "S"]),
  // This deliberately narrow route never silently omits unsupported personal tax circumstances.
  onlyThisBusinessIncome: z.literal(true),
  standardPersonalAllowance: z.literal(true),
  noOtherChargesOrReliefs: z.literal(true),
  businessOperatedFullYear: z.literal(true),
  standardNationalInsurance: z.literal(true),
  class2Choice: z.enum(["not_needed", "do_not_pay", "pay_voluntarily"]),
});
export type SelfAssessmentIdentity = z.infer<typeof SelfAssessmentIdentitySchema>;
export class SelfAssessmentFilingError extends Error {}

export function calculateSimpleSelfAssessment(
  report: SelfAssessmentReport,
  identity: SelfAssessmentIdentity,
) {
  SelfAssessmentIdentitySchema.parse(identity);
  if (report.filingBlockers.length)
    throw new SelfAssessmentFilingError(report.filingBlockers.join(" "));
  if (report.taxYear !== 2025)
    throw new SelfAssessmentFilingError("This filing specification is for 2025/26 only.");
  // This release supports standard NI for someone aged 16-65 at the start of 2025/26.
  if (identity.dateOfBirth <= "1959-04-06" || identity.dateOfBirth > "2009-04-06") {
    throw new SelfAssessmentFilingError(
      "Your age needs a National Insurance review. Use HMRC or an accountant to complete this return.",
    );
  }
  if (
    report.profile.businessDescription.length > 42 ||
    !hmrcText.safeParse(report.profile.businessDescription).success
  ) {
    throw new SelfAssessmentFilingError(
      "For HMRC filing, shorten the business description to 42 characters using letters, numbers and basic punctuation.",
    );
  }
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
  if (profit < 0)
    throw new SelfAssessmentFilingError(
      "The rounded return has a loss. Review loss relief with HMRC or an accountant.",
    );
  if (identity.class2Choice === "pay_voluntarily")
    throw new SelfAssessmentFilingError(
      "Complete voluntary Class 2 contributions through HMRC or an accountant; Tamias does not yet calculate contribution weeks.",
    );
  if (profit < 6845 && identity.class2Choice !== "do_not_pay")
    throw new SelfAssessmentFilingError(
      "Choose whether to pay voluntary Class 2 National Insurance before preparing this return.",
    );
  // 2025/26 rates. Only this business, full personal allowance, no adjustments, income < £90,000.
  const taxable = Math.max(0, profit - 12570);
  const bands =
    identity.taxpayerStatus === "S"
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
  return {
    groups,
    incomePounds: income,
    expensesPounds: expenses,
    profitPounds: profit,
    personalAllowancePounds: Math.min(12570, profit),
    incomeTaxPence,
    class4Pence,
    class2Pence: 0,
    totalTaxPence: incomeTaxPence + class4Pence,
    includesPaymentsOnAccount: false as const,
  };
}
export type SimpleSelfAssessmentCalculation = ReturnType<typeof calculateSimpleSelfAssessment>;

// Generated text nodes use canonical XML escaping. All element/attribute names are constants.
// There are no comments, processing instructions, empty-element shortcuts or undeclared namespaces.
// scripts/validate-self-assessment.py independently checks the complete Body against libxml2 C14N.
export function canonicalXmlText(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\r", "&#xD;");
}
const tag = (name: string, value: string | number) =>
  `<${name}>${canonicalXmlText(value)}</${name}>`;
const nested = (name: string, xml: string) => `<${name}>${xml}</${name}>`;

function base32(bytes: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0,
    value = 0,
    output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

export function buildSelfAssessmentBody(
  report: SelfAssessmentReport,
  identity: SelfAssessmentIdentity,
) {
  const calculation = calculateSimpleSelfAssessment(report, identity);
  const amount = (id: string) => calculation.groups.find((g) => g.id === id)?.wholePounds ?? 0;
  const pounds = (value: number) => value.toFixed(2);
  const header =
    nested("Keys", `<Key Type="UTR">${identity.utr}</Key>`) +
    tag("PeriodEnd", "2026-04-05") +
    tag("DefaultCurrency", "GBP") +
    nested(
      "Manifest",
      nested(
        "Contains",
        nested(
          "Reference",
          tag("Namespace", SA_2026_NAMESPACE) +
            tag("SchemaVersion", "2026-v1.2") +
            tag("TopElementName", "MTR"),
        ),
      ),
    );
  const sa100 = nested(
    "SA100",
    nested(
      "YourPersonalDetails",
      tag("DateOfBirth", identity.dateOfBirth) +
        tag("NationalInsuranceNumber", identity.nino) +
        tag("TaxpayerStatus", identity.taxpayerStatus),
    ) +
      nested(
        "YourTaxReturn",
        tag("ShortSelfEmploymentSchedule", "yes") +
          tag("NumberOfShortSelfEmploymentSchedules", "1"),
      ),
  );
  const expenseNames: Record<string, string> = {
    goods: "CostOfGoods",
    travel: "CarVanAndTravelExpenses",
    staff: "WagesSalariesAndStaffCosts",
    premises: "RentAndOtherPropertyCosts",
    repairs: "RepairsAndMaintenanceCosts",
    professional: "AccountancyAndLegalFees",
    finance: "InterestAndFinanceCharges",
    office: "PhoneAndOtherOfficeCosts",
    other_expenses: "OtherAllowableBusinessExpenses",
  };
  const expenses =
    Object.entries(expenseNames)
      .filter(([id]) => amount(id) !== 0)
      .map(([id, name]) => tag(name, pounds(amount(id))))
      .join("") + tag("TotalAllowableExpenses", pounds(calculation.expensesPounds));
  const sa103s = nested(
    "SA103S",
    nested(
      "BusinessDetails",
      tag("BusinessDescription", report.profile.businessDescription) +
        tag("DidYourBusinessStart", "no") +
        tag("DidYourBusinessCease", "no") +
        tag("DateBusinessBooksAreMadeUpTo", "2026-04-05"),
    ) +
      nested(
        "BusinessIncome",
        tag("Turnover", pounds(amount("turnover"))) +
          (amount("other_income")
            ? tag("OtherBusinessIncome", pounds(amount("other_income")))
            : ""),
      ) +
      nested("AllowableBusinessExpenses", expenses) +
      tag("NetProfitOrLoss", pounds(calculation.profitPounds)) +
      nested("TaxableProfits", tag("NetBusinessProfitForTax", pounds(calculation.profitPounds))) +
      nested(
        "ProfitsLossesNICsAndCIS",
        tag("TotalTaxableBusinessProfits", pounds(calculation.profitPounds)),
      ),
  );
  const sa110 = nested(
    "SA110",
    nested(
      "SelfAssessment",
      tag("TotalTaxEtcDue", (calculation.totalTaxPence / 100).toFixed(2)) +
        tag("Class4NICsDue", (calculation.class4Pence / 100).toFixed(2)),
    ) + nested("UnderpaidTax", ""),
  );
  const mtr = nested(
    "MTR",
    sa100 +
      sa103s +
      sa110 +
      tag("TaxpayerName", identity.fullName) +
      nested("Declaration", tag("IndividualDeclaration", "yes")),
  );
  const body = (irmark?: string) =>
    `<Body xmlns="${GOVTALK_NAMESPACE}"><IRenvelope xmlns="${SA_2026_NAMESPACE}">${nested("IRheader", header + (irmark ? `<IRmark Type="generic">${irmark}</IRmark>` : "") + tag("Sender", "Individual"))}${mtr}</IRenvelope></Body>`;
  const canonicalBody = body();
  // SHA-1 is prescribed by HMRC for the legacy IRmark, not used for authentication or secrets.
  const digest = createHash("sha1").update(canonicalBody, "utf8").digest();
  return {
    bodyXml: body(digest.toString("base64")),
    canonicalBody,
    irMark: digest.toString("base64"),
    irMarkDisplay: base32(digest),
    calculation,
  };
}
