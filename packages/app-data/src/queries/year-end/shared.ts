import type {
  CorporationTaxAdjustmentCategory,
  HmrcCtEnvironment,
  LedgerAccountType,
} from "@tamias/compliance";
import type {
  ComplianceObligationRecord,
  FilingProfileRecord,
} from "@tamias/app-data-convex";

export const SMALL_PROFITS_RATE_START = "2023-04-01";
export type TeamContext = {
  id: string;
  name: string | null;
  countryCode: string | null;
  baseCurrency: string | null;
};

export type AnnualPeriod = {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  accountsDueDate: string;
  corporationTaxDueDate: string;
};

export type HmrcCtRuntimeStatus = {
  environment: HmrcCtEnvironment;
  configured: boolean;
  submissionReference: string | null;
  submissionReferenceSource: "hmrc_test_utr" | "filing_profile_utr" | "missing";
};

export type SubmissionArtifactBundleRecord = {
  filePath: string;
  fileName: string;
  generatedAt: string;
  checksum: string;
};

export type YearEndPeriodContext = AnnualPeriod & {
  obligations: {
    accounts: ComplianceObligationRecord;
    corporationTax: ComplianceObligationRecord;
  };
};

export type TrialBalanceLine = {
  accountCode: string;
  accountName: string;
  accountType: LedgerAccountType;
  debit: number;
  credit: number;
  balance: number;
};

export type SummaryLine = {
  key: string;
  label: string;
  amount: number;
};

export type WorkingPaperSection = {
  key:
    | "bank"
    | "receivables"
    | "payables"
    | "vat"
    | "debt"
    | "equity"
    | "tax_accruals";
  label: string;
  total: number;
  lines: Array<{
    accountCode: string;
    accountName: string;
    accountType: LedgerAccountType;
    balance: number;
  }>;
};

export type RetainedEarningsRollforward = {
  openingBalance: number;
  currentPeriodProfit: number;
  manualEquityAdjustments: number;
  closingBalance: number;
};

export type CorporationTaxSummary = {
  accountingProfitBeforeTax: number;
  manualAdjustmentsTotal: number;
  taxableProfit: number;
  estimatedTaxRate: number;
  estimatedCorporationTaxDue: number;
  grossCorporationTaxDue: number;
  marginalRelief: number;
  exemptDistributions: number;
  augmentedProfits: number;
  startingOrSmallCompaniesRate: boolean;
  associatedCompaniesMode: "this_period" | "financial_years" | "not_applicable";
  associatedCompaniesThisPeriod: number | null;
  associatedCompaniesFirstYear: number | null;
  associatedCompaniesSecondYear: number | null;
  financialYears: CorporationTaxRateSummary["financialYears"];
  adjustments: Array<{
    id: string;
    category: string;
    label: string;
    amount: number;
    note: string | null;
    createdAt: string;
  }>;
};

export type FilingReadiness = {
  supportedPath: string;
  isReady: boolean;
  blockers: string[];
  warnings: string[];
};

export type CtComputationBreakdown = {
  profitLossPerAccounts: number;
  depreciationAmortisationAdjustments: number;
  capitalAllowancesBalancingCharges: number;
  netTradingProfits: number;
  totalCapitalAllowances: number;
  profitsBeforeChargesAndGroupRelief: number;
  qualifyingDonations: number;
  lossesBroughtForward: number;
  groupReliefClaimed: number;
  totalProfitsChargeableToCorporationTax: number;
};

export type Ct600aLoanEntry = {
  name: string;
  amountOfLoan: number;
};

export type Ct600aReliefEntry = {
  name: string;
  amountRepaid: number | null;
  amountReleasedOrWrittenOff: number | null;
  date: string;
};

export type Ct600aReliefSection = {
  loans: Ct600aReliefEntry[];
  totalAmountRepaid: number | null;
  totalAmountReleasedOrWritten: number | null;
  totalLoans: number;
  reliefDue: number;
};

export type Ct600aSupplement = {
  beforeEndPeriod: boolean;
  loansInformation: {
    loans: Ct600aLoanEntry[];
    totalLoans: number;
    taxChargeable: number;
  } | null;
  reliefEarlierThan: Ct600aReliefSection | null;
  loanLaterReliefNow: Ct600aReliefSection | null;
  totalLoansOutstanding: number | null;
  taxPayable: number;
};

export type CorporationTaxRateSummary = {
  exemptDistributions: number;
  augmentedProfits: number;
  grossCorporationTaxDue: number;
  marginalRelief: number;
  netCorporationTaxDue: number;
  effectiveTaxRate: number;
  associatedCompaniesMode: "this_period" | "financial_years" | "not_applicable";
  associatedCompaniesThisPeriod: number | null;
  associatedCompaniesFirstYear: number | null;
  associatedCompaniesSecondYear: number | null;
  startingOrSmallCompaniesRate: boolean;
  financialYears: Array<{
    financialYear: number;
    periodStart: string;
    periodEnd: string;
    daysInSegment: number;
    associatedCompanies: number | null;
    chargeableProfits: number;
    augmentedProfits: number;
    lowerLimit: number | null;
    upperLimit: number | null;
    taxRate: number;
    grossCorporationTax: number;
    marginalRelief: number;
    netCorporationTax: number;
    chargeType:
      | "flat_main_rate"
      | "main_rate"
      | "small_profits_rate"
      | "marginal_relief";
  }>;
};

export type StatutoryAccountsDraft = {
  generatedAt: string;
  companyName: string;
  companyNumber: string | null;
  periodStart: string;
  periodEnd: string;
  accountsDueDate: string;
  currency: string;
  accountingBasis: string;
  principalActivity: string | null;
  directors: string[];
  signingDirectorName: string | null;
  approvalDate: string | null;
  averageEmployeeCount: number | null;
  ordinaryShareCount: number | null;
  ordinaryShareNominalValue: number | null;
  dormant: boolean | null;
  auditExemptionClaimed: boolean | null;
  membersDidNotRequireAudit: boolean | null;
  directorsAcknowledgeResponsibilities: boolean | null;
  accountsPreparedUnderSmallCompaniesRegime: boolean | null;
  statementOfFinancialPosition: {
    assets: number;
    liabilities: number;
    netAssets: number;
    shareCapital: number;
    retainedEarnings: number;
    otherReserves: number;
    totalEquity: number;
  };
  profitAndLoss: SummaryLine[];
  balanceSheet: SummaryLine[];
  retainedEarnings: RetainedEarningsRollforward;
  corporationTax: CorporationTaxSummary | null;
  workingPaperNotes: Array<{
    key: string;
    label: string;
    total: number;
    lines: Array<{
      label: string;
      amount: number;
    }>;
  }>;
  reviewItems: string[];
  limitations: string[];
  filingReadiness: FilingReadiness;
};

export type Ct600Draft = {
  generatedAt: string;
  companyName: string;
  companyNumber: string | null;
  utr: string | null;
  periodStart: string;
  periodEnd: string;
  accountsDueDate: string;
  currency: string;
  companyType: number;
  turnover: number;
  tradingProfits: number;
  lossesBroughtForward: number;
  netProfits: number;
  profitsBeforeOtherDeductions: number;
  profitsBeforeDonationsAndGroupRelief: number;
  chargeableProfits: number;
  corporationTax: number;
  netCorporationTaxChargeable: number;
  netCorporationTaxLiability: number;
  taxChargeable: number;
  taxPayable: number;
  loansToParticipatorsTax: number;
  ct600AReliefDue: boolean;
  taxRate: number;
  financialYear: number;
  grossCorporationTax: number;
  marginalRelief: number;
  exemptDistributions: number;
  augmentedProfits: number;
  startingOrSmallCompaniesRate: boolean;
  associatedCompaniesMode: "this_period" | "financial_years" | "not_applicable";
  associatedCompaniesThisPeriod: number | null;
  associatedCompaniesFirstYear: number | null;
  associatedCompaniesSecondYear: number | null;
  financialYearBreakdown: CorporationTaxRateSummary["financialYears"];
  declarationName: string;
  declarationStatus: string;
  returnType: "new";
  computationBreakdown: CtComputationBreakdown;
  supplementaryPages: {
    ct600a: Ct600aSupplement | null;
  };
  reviewItems: string[];
  limitations: string[];
  filingReadiness: FilingReadiness;
};

export type ManualJournalInput = {
  id?: string;
  effectiveDate: string;
  description: string;
  reference?: string | null;
  lines: Array<{
    accountCode: string;
    description?: string | null;
    debit: number;
    credit: number;
  }>;
};

export type CorporationTaxAdjustmentInput = {
  id?: string;
  category?: CorporationTaxAdjustmentCategory;
  label: string;
  amount: number;
  note?: string | null;
};

export type CtSubmissionArtifacts = {
  statutoryAccountsDraft: StatutoryAccountsDraft;
  statutoryAccountsDraftHtml: string;
  statutoryAccountsDraftJson: string;
  ct600Draft: Ct600Draft;
  ct600DraftXml: string;
  ct600DraftJson: string;
  accountsAttachmentIxbrl: string;
  computationsAttachmentIxbrl: string;
};

export const HMRC_ACCEPTED_FRC_2025_FRS_102_ENTRY_POINT =
  "https://xbrl.frc.org.uk/FRS-102/2025-01-01/FRS-102-2025-01-01.xsd";
export const HMRC_CT_COMPUTATIONS_2024_ENTRY_POINT =
  "http://www.hmrc.gov.uk/schemas/ct/comp/2024-01-01/ct-comp-2024.xsd";
export const SUPPORTED_SMALL_COMPANY_FILING_PATH =
  "UK small-company FRS 102 Section 1A accounts and CT600 with structured HMRC computation categories";

export function getHmrcCtEnvironment(): HmrcCtEnvironment {
  return process.env.HMRC_CT_ENVIRONMENT === "production"
    ? "production"
    : "test";
}

export function getHmrcCtRuntimeStatus(
  profile?: Pick<FilingProfileRecord, "utr"> | null,
): HmrcCtRuntimeStatus {
  const environment = getHmrcCtEnvironment();
  const configured = Boolean(
    process.env.HMRC_CT_SENDER_ID &&
      process.env.HMRC_CT_SENDER_PASSWORD &&
      process.env.HMRC_CT_VENDOR_ID,
  );
  const testReference = process.env.HMRC_CT_TEST_UTR?.trim() || null;
  const filingProfileReference = profile?.utr?.trim() || null;

  if (environment === "test" && testReference) {
    return {
      environment,
      configured,
      submissionReference: testReference,
      submissionReferenceSource: "hmrc_test_utr",
    };
  }

  if (filingProfileReference) {
    return {
      environment,
      configured,
      submissionReference: filingProfileReference,
      submissionReferenceSource: "filing_profile_utr",
    };
  }

  return {
    environment,
    configured,
    submissionReference: null,
    submissionReferenceSource: "missing",
  };
}

export function getSummaryAmount(lines: SummaryLine[], key: string) {
  return lines.find((line) => line.key === key)?.amount ?? 0;
}

function getWorkingPaperSection(
  workingPapers: WorkingPaperSection[],
  key: WorkingPaperSection["key"],
) {
  return workingPapers.find((section) => section.key === key) ?? null;
}

function getWorkingPaperLineAmount(
  section: WorkingPaperSection | null,
  accountCode: string,
) {
  return (
    section?.lines.find((line) => line.accountCode === accountCode)?.balance ??
    0
  );
}

export function formatDraftDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDraftAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function humanizeToken(value: string) {
  return value
    .replaceAll(/[_-]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
