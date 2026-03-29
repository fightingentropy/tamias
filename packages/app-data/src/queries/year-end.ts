import { createHash } from "node:crypto";
import { PassThrough } from "node:stream";
import { writeToString } from "@fast-csv/format";
import {
  CompaniesHouseXmlGatewayProvider,
  HmrcCtProvider,
  isUkComplianceVisible,
  type CorporationTaxAdjustmentCategory,
  type CompaniesHouseGatewayMessage,
  type HmrcCtEnvironment,
  type CompaniesHouseSubmissionStatus,
  type LedgerAccountType,
  roundCurrency,
  UK_SYSTEM_LEDGER_ACCOUNTS,
} from "@tamias/compliance";
import type {
  ComplianceJournalEntryRecord,
  ComplianceJournalLineRecord,
  CloseCompanyLoansScheduleRecord,
  ComplianceObligationRecord,
  CorporationTaxRateScheduleRecord,
  CorporationTaxAdjustmentRecord,
  CurrentUserIdentityRecord,
  ExportBundleRecord,
  FilingProfileRecord,
  PayrollRunRecord,
  YearEndPackRecord,
} from "@tamias/app-data-convex";
import {
  deleteComplianceJournalEntryBySourceInConvex,
  deleteCloseCompanyLoansScheduleInConvex,
  deleteCorporationTaxRateScheduleInConvex,
  deleteCorporationTaxAdjustmentInConvex,
  createSubmissionEventInConvex,
  getCloseCompanyLoansScheduleByPeriodFromConvex,
  getCorporationTaxRateScheduleByPeriodFromConvex,
  getYearEndPackByPeriodFromConvex,
  listComplianceJournalEntriesFromConvex,
  listComplianceObligationsFromConvex,
  listCorporationTaxAdjustmentsForPeriodFromConvex,
  listPayrollRunsFromConvex,
  listSubmissionEventsFromConvex,
  upsertCloseCompanyLoansScheduleInConvex,
  upsertComplianceJournalEntryInConvex,
  upsertComplianceObligationInConvex,
  upsertCorporationTaxRateScheduleInConvex,
  upsertCorporationTaxAdjustmentInConvex,
  upsertYearEndPackInConvex,
} from "@tamias/app-data-convex";
import { uploadVaultFile } from "@tamias/storage";
import archiver from "archiver";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isAfter,
  isValid,
  parseISO,
} from "date-fns";
import type { Database } from "../client";
import { getFilingProfile, rebuildDerivedLedger } from "./compliance";
import { getTeamById } from "./teams";
import {
  renderAccountsAttachmentIxbrl,
  renderComputationsAttachmentIxbrl,
  renderCt600DraftXml,
  renderStatutoryAccountsDraftHtml,
} from "./year-end/rendering";
export {
  renderAccountsAttachmentIxbrl,
  renderComputationsAttachmentIxbrl,
  renderCt600DraftXml,
  renderStatutoryAccountsDraftHtml,
} from "./year-end/rendering";

const SMALL_PROFITS_RATE_START = "2023-04-01";
const PRE_SMALL_PROFITS_MAIN_RATE = 0.19;
const SMALL_PROFITS_MAIN_RATE = 0.25;
const SMALL_PROFITS_RATE = 0.19;
const SMALL_PROFITS_LOWER_LIMIT = 50_000;
const SMALL_PROFITS_UPPER_LIMIT = 250_000;
const SMALL_PROFITS_MARGINAL_RELIEF_FRACTION = 3 / 200;

type TeamContext = {
  id: string;
  name: string | null;
  countryCode: string | null;
  baseCurrency: string | null;
};

type AnnualPeriod = {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  accountsDueDate: string;
  corporationTaxDueDate: string;
};

type HmrcCtRuntimeStatus = {
  environment: HmrcCtEnvironment;
  configured: boolean;
  submissionReference: string | null;
  submissionReferenceSource: "hmrc_test_utr" | "filing_profile_utr" | "missing";
};

type SubmissionArtifactBundleRecord = {
  filePath: string;
  fileName: string;
  generatedAt: string;
  checksum: string;
};

type YearEndPeriodContext = AnnualPeriod & {
  obligations: {
    accounts: ComplianceObligationRecord;
    corporationTax: ComplianceObligationRecord;
  };
};

type TrialBalanceLine = {
  accountCode: string;
  accountName: string;
  accountType: LedgerAccountType;
  debit: number;
  credit: number;
  balance: number;
};

type SummaryLine = {
  key: string;
  label: string;
  amount: number;
};

type WorkingPaperSection = {
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

type RetainedEarningsRollforward = {
  openingBalance: number;
  currentPeriodProfit: number;
  manualEquityAdjustments: number;
  closingBalance: number;
};

type CorporationTaxSummary = {
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

type FilingReadiness = {
  supportedPath: string;
  isReady: boolean;
  blockers: string[];
  warnings: string[];
};

type CtComputationBreakdown = {
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

type Ct600aLoanEntry = {
  name: string;
  amountOfLoan: number;
};

type Ct600aReliefEntry = {
  name: string;
  amountRepaid: number | null;
  amountReleasedOrWrittenOff: number | null;
  date: string;
};

type Ct600aReliefSection = {
  loans: Ct600aReliefEntry[];
  totalAmountRepaid: number | null;
  totalAmountReleasedOrWritten: number | null;
  totalLoans: number;
  reliefDue: number;
};

type Ct600aSupplement = {
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

type CorporationTaxRateSummary = {
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

type StatutoryAccountsDraft = {
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

type Ct600Draft = {
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

type ManualJournalInput = {
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

type CorporationTaxAdjustmentInput = {
  id?: string;
  category?: CorporationTaxAdjustmentCategory;
  label: string;
  amount: number;
  note?: string | null;
};

type CtSubmissionArtifacts = {
  statutoryAccountsDraft: StatutoryAccountsDraft;
  statutoryAccountsDraftHtml: string;
  statutoryAccountsDraftJson: string;
  ct600Draft: Ct600Draft;
  ct600DraftXml: string;
  ct600DraftJson: string;
  accountsAttachmentIxbrl: string;
  computationsAttachmentIxbrl: string;
};

const HMRC_ACCEPTED_FRC_2025_FRS_102_ENTRY_POINT =
  "https://xbrl.frc.org.uk/FRS-102/2025-01-01/FRS-102-2025-01-01.xsd";
const HMRC_CT_COMPUTATIONS_2024_ENTRY_POINT =
  "http://www.hmrc.gov.uk/schemas/ct/comp/2024-01-01/ct-comp-2024.xsd";
const SUPPORTED_SMALL_COMPANY_FILING_PATH =
  "UK small-company FRS 102 Section 1A accounts and CT600 with structured HMRC computation categories";

function normalizeDirectorList(directors: string[] | null | undefined) {
  return (directors ?? [])
    .map((director) => director.trim())
    .filter((director) => director.length > 0);
}

function groupCorporationTaxAdjustments(
  adjustments: Array<{
    category?: string | null;
    amount: number;
  }>,
) {
  const totals = {
    depreciationAmortisation: 0,
    charitableDonations: 0,
    capitalAllowances: 0,
    capitalAllowancesBalancingCharges: 0,
    lossesBroughtForward: 0,
    groupRelief: 0,
    other: 0,
  };

  for (const adjustment of adjustments) {
    switch (adjustment.category) {
      case "depreciation_amortisation":
        totals.depreciationAmortisation += adjustment.amount;
        break;
      case "charitable_donations":
        totals.charitableDonations += adjustment.amount;
        break;
      case "capital_allowances":
        totals.capitalAllowances += adjustment.amount;
        break;
      case "capital_allowances_balancing_charges":
        totals.capitalAllowancesBalancingCharges += adjustment.amount;
        break;
      case "losses_brought_forward":
        totals.lossesBroughtForward += adjustment.amount;
        break;
      case "group_relief":
        totals.groupRelief += adjustment.amount;
        break;
      default:
        totals.other += adjustment.amount;
        break;
    }
  }

  return {
    depreciationAmortisation: roundCurrency(totals.depreciationAmortisation),
    charitableDonations: roundCurrency(Math.abs(totals.charitableDonations)),
    capitalAllowances: roundCurrency(Math.abs(totals.capitalAllowances)),
    capitalAllowancesBalancingCharges: roundCurrency(
      totals.capitalAllowancesBalancingCharges,
    ),
    lossesBroughtForward: roundCurrency(Math.abs(totals.lossesBroughtForward)),
    groupRelief: roundCurrency(Math.abs(totals.groupRelief)),
    other: roundCurrency(totals.other),
  };
}

function createFilingReadiness(blockers: string[], warnings: string[]) {
  return {
    supportedPath: SUPPORTED_SMALL_COMPANY_FILING_PATH,
    isReady: blockers.length === 0,
    blockers,
    warnings,
  } satisfies FilingReadiness;
}

function getCorporationTaxFinancialYear(value: string | Date) {
  const date = typeof value === "string" ? parseISO(value) : value;

  return date.getUTCMonth() >= 3
    ? date.getUTCFullYear()
    : date.getUTCFullYear() - 1;
}

function getCorporationTaxFinancialYearStart(financialYear: number) {
  return new Date(Date.UTC(financialYear, 3, 1));
}

function getCorporationTaxFinancialYearEnd(financialYear: number) {
  return new Date(Date.UTC(financialYear + 1, 2, 31));
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function inclusiveDayCount(start: Date, end: Date) {
  return differenceInCalendarDays(end, start) + 1;
}

function apportionAmountByDays(total: number, dayCounts: number[]) {
  if (!dayCounts.length) {
    return [] as number[];
  }

  const totalDays = dayCounts.reduce((sum, days) => sum + days, 0);
  let allocated = 0;

  return dayCounts.map((days, index) => {
    if (index === dayCounts.length - 1) {
      return roundCurrency(total - allocated);
    }

    const apportioned = roundCurrency((total * days) / totalDays);
    allocated = roundCurrency(allocated + apportioned);
    return apportioned;
  });
}

function resolveCorporationTaxFinancialYearSegments(args: {
  periodStart: string;
  periodEnd: string;
}) {
  const periodStart = parseISO(args.periodStart);
  const periodEnd = parseISO(args.periodEnd);
  const startFinancialYear = getCorporationTaxFinancialYear(periodStart);
  const endFinancialYear = getCorporationTaxFinancialYear(periodEnd);
  const segments: Array<{
    financialYear: number;
    periodStart: string;
    periodEnd: string;
    daysInSegment: number;
    daysInFinancialYear: number;
  }> = [];

  for (
    let financialYear = startFinancialYear;
    financialYear <= endFinancialYear;
    financialYear += 1
  ) {
    const financialYearStart =
      getCorporationTaxFinancialYearStart(financialYear);
    const financialYearEnd = getCorporationTaxFinancialYearEnd(financialYear);
    const segmentStart =
      periodStart.getTime() > financialYearStart.getTime()
        ? periodStart
        : financialYearStart;
    const segmentEnd =
      periodEnd.getTime() < financialYearEnd.getTime()
        ? periodEnd
        : financialYearEnd;

    if (segmentStart.getTime() > segmentEnd.getTime()) {
      continue;
    }

    segments.push({
      financialYear,
      periodStart: formatIsoDate(segmentStart),
      periodEnd: formatIsoDate(segmentEnd),
      daysInSegment: inclusiveDayCount(segmentStart, segmentEnd),
      daysInFinancialYear: inclusiveDayCount(
        financialYearStart,
        financialYearEnd,
      ),
    });
  }

  return segments;
}

function resolveCorporationTaxRateScheduleMode(
  schedule: CorporationTaxRateScheduleRecord | null | undefined,
  segmentCount: number,
) {
  if (segmentCount === 0) {
    return "not_applicable" as const;
  }

  if (
    segmentCount > 1 &&
    (schedule?.associatedCompaniesFirstYear != null ||
      schedule?.associatedCompaniesSecondYear != null)
  ) {
    return "financial_years" as const;
  }

  return "this_period" as const;
}

function buildCorporationTaxRateSummary(args: {
  periodStart: string;
  periodEnd: string;
  chargeableProfits: number;
  rateSchedule?: CorporationTaxRateScheduleRecord | null;
}): CorporationTaxRateSummary {
  const segments = resolveCorporationTaxFinancialYearSegments({
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
  });
  const chargeableProfits = roundCurrency(Math.max(args.chargeableProfits, 0));
  const exemptDistributions = roundCurrency(
    Math.max(args.rateSchedule?.exemptDistributions ?? 0, 0),
  );
  const usesSmallProfitsRules = segments.some(
    (segment) => segment.financialYear >= 2023,
  );
  const associatedCompaniesMode = usesSmallProfitsRules
    ? resolveCorporationTaxRateScheduleMode(args.rateSchedule, segments.length)
    : ("not_applicable" as const);
  const associatedCompaniesThisPeriod =
    segments.length > 0 && associatedCompaniesMode === "this_period"
      ? (args.rateSchedule?.associatedCompaniesThisPeriod ?? 0)
      : null;
  const associatedCompaniesFirstYear =
    segments.length > 1 && associatedCompaniesMode === "financial_years"
      ? (args.rateSchedule?.associatedCompaniesFirstYear ?? 0)
      : null;
  const associatedCompaniesSecondYear =
    segments.length > 1 && associatedCompaniesMode === "financial_years"
      ? (args.rateSchedule?.associatedCompaniesSecondYear ?? 0)
      : null;
  const apportionedChargeableProfits = apportionAmountByDays(
    chargeableProfits,
    segments.map((segment) => segment.daysInSegment),
  );
  const apportionedExemptDistributions = apportionAmountByDays(
    exemptDistributions,
    segments.map((segment) => segment.daysInSegment),
  );
  const financialYears = segments.map((segment, index) => {
    const associatedCompanies =
      associatedCompaniesMode === "financial_years"
        ? index === 0
          ? (associatedCompaniesFirstYear ?? 0)
          : (associatedCompaniesSecondYear ?? 0)
        : associatedCompaniesMode === "this_period"
          ? (associatedCompaniesThisPeriod ?? 0)
          : null;
    const segmentChargeableProfits = apportionedChargeableProfits[index] ?? 0;
    const segmentExemptDistributions =
      apportionedExemptDistributions[index] ?? 0;
    const segmentAugmentedProfits = roundCurrency(
      segmentChargeableProfits + segmentExemptDistributions,
    );

    if (segment.financialYear < 2023) {
      const grossCorporationTax = roundCurrency(
        segmentChargeableProfits * PRE_SMALL_PROFITS_MAIN_RATE,
      );

      return {
        financialYear: segment.financialYear,
        periodStart: segment.periodStart,
        periodEnd: segment.periodEnd,
        daysInSegment: segment.daysInSegment,
        associatedCompanies,
        chargeableProfits: segmentChargeableProfits,
        augmentedProfits: segmentAugmentedProfits,
        lowerLimit: null,
        upperLimit: null,
        taxRate: roundCurrency(PRE_SMALL_PROFITS_MAIN_RATE * 100),
        grossCorporationTax,
        marginalRelief: 0,
        netCorporationTax: grossCorporationTax,
        chargeType: "flat_main_rate" as const,
      };
    }

    const divisor = Math.max((associatedCompanies ?? 0) + 1, 1);
    const lowerLimit = roundCurrency(
      (SMALL_PROFITS_LOWER_LIMIT * segment.daysInSegment) /
        segment.daysInFinancialYear /
        divisor,
    );
    const upperLimit = roundCurrency(
      (SMALL_PROFITS_UPPER_LIMIT * segment.daysInSegment) /
        segment.daysInFinancialYear /
        divisor,
    );
    const grossMainRateTax = roundCurrency(
      segmentChargeableProfits * SMALL_PROFITS_MAIN_RATE,
    );

    if (segmentAugmentedProfits <= lowerLimit) {
      const grossCorporationTax = roundCurrency(
        segmentChargeableProfits * SMALL_PROFITS_RATE,
      );

      return {
        financialYear: segment.financialYear,
        periodStart: segment.periodStart,
        periodEnd: segment.periodEnd,
        daysInSegment: segment.daysInSegment,
        associatedCompanies,
        chargeableProfits: segmentChargeableProfits,
        augmentedProfits: segmentAugmentedProfits,
        lowerLimit,
        upperLimit,
        taxRate: roundCurrency(SMALL_PROFITS_RATE * 100),
        grossCorporationTax,
        marginalRelief: 0,
        netCorporationTax: grossCorporationTax,
        chargeType: "small_profits_rate" as const,
      };
    }

    if (segmentAugmentedProfits > upperLimit) {
      return {
        financialYear: segment.financialYear,
        periodStart: segment.periodStart,
        periodEnd: segment.periodEnd,
        daysInSegment: segment.daysInSegment,
        associatedCompanies,
        chargeableProfits: segmentChargeableProfits,
        augmentedProfits: segmentAugmentedProfits,
        lowerLimit,
        upperLimit,
        taxRate: roundCurrency(SMALL_PROFITS_MAIN_RATE * 100),
        grossCorporationTax: grossMainRateTax,
        marginalRelief: 0,
        netCorporationTax: grossMainRateTax,
        chargeType: "main_rate" as const,
      };
    }

    const marginalRelief = roundCurrency(
      (upperLimit - segmentAugmentedProfits) *
        SMALL_PROFITS_MARGINAL_RELIEF_FRACTION,
    );

    return {
      financialYear: segment.financialYear,
      periodStart: segment.periodStart,
      periodEnd: segment.periodEnd,
      daysInSegment: segment.daysInSegment,
      associatedCompanies,
      chargeableProfits: segmentChargeableProfits,
      augmentedProfits: segmentAugmentedProfits,
      lowerLimit,
      upperLimit,
      taxRate: roundCurrency(SMALL_PROFITS_MAIN_RATE * 100),
      grossCorporationTax: grossMainRateTax,
      marginalRelief,
      netCorporationTax: roundCurrency(grossMainRateTax - marginalRelief),
      chargeType: "marginal_relief" as const,
    };
  });
  const grossCorporationTaxDue = roundCurrency(
    financialYears.reduce((total, item) => total + item.grossCorporationTax, 0),
  );
  const marginalRelief = roundCurrency(
    financialYears.reduce((total, item) => total + item.marginalRelief, 0),
  );
  const netCorporationTaxDue = roundCurrency(
    grossCorporationTaxDue - marginalRelief,
  );
  const augmentedProfits = roundCurrency(
    chargeableProfits + exemptDistributions,
  );
  const effectiveTaxRate =
    chargeableProfits > 0
      ? roundCurrency((netCorporationTaxDue / chargeableProfits) * 100) / 100
      : 0;

  return {
    exemptDistributions,
    augmentedProfits,
    grossCorporationTaxDue,
    marginalRelief,
    netCorporationTaxDue,
    effectiveTaxRate,
    associatedCompaniesMode,
    associatedCompaniesThisPeriod,
    associatedCompaniesFirstYear,
    associatedCompaniesSecondYear,
    startingOrSmallCompaniesRate: financialYears.some(
      (item) =>
        item.chargeType === "small_profits_rate" ||
        item.chargeType === "marginal_relief",
    ),
    financialYears,
  };
}

function validateCorporationTaxRateSchedule(args: {
  schedule: CorporationTaxRateScheduleRecord | null | undefined;
  periodStart: string;
  periodEnd: string;
}) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const periodEnd = parseISO(args.periodEnd);
  const segments = resolveCorporationTaxFinancialYearSegments({
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
  });
  const periodUsesSmallProfitsRules =
    periodEnd.getTime() >= parseISO(SMALL_PROFITS_RATE_START).getTime();
  const schedule = args.schedule;

  if (!periodUsesSmallProfitsRules) {
    if (
      schedule &&
      (schedule.exemptDistributions != null ||
        schedule.associatedCompaniesThisPeriod != null ||
        schedule.associatedCompaniesFirstYear != null ||
        schedule.associatedCompaniesSecondYear != null)
    ) {
      warnings.push(
        "Saved CT rate inputs are ignored for periods ending before 1 April 2023.",
      );
    }

    return { blockers, warnings };
  }

  if (!schedule) {
    blockers.push(
      "Save the CT rate inputs to confirm associated companies and exempt distributions for the period.",
    );
    warnings.push(
      "Until the CT rate inputs are saved, the draft assumes zero associated companies and zero exempt distributions.",
    );
    return { blockers, warnings };
  }

  const hasThisPeriod = schedule.associatedCompaniesThisPeriod != null;
  const hasFirstYear = schedule.associatedCompaniesFirstYear != null;
  const hasSecondYear = schedule.associatedCompaniesSecondYear != null;

  if (hasThisPeriod && (hasFirstYear || hasSecondYear)) {
    blockers.push(
      "Use either one associated-companies count for the whole period or separate first-year and second-year counts, not both.",
    );
  }

  if (!hasThisPeriod && !hasFirstYear && !hasSecondYear) {
    blockers.push(
      "Enter the number of associated companies for the period, even if the answer is 0.",
    );
  }

  if (!hasThisPeriod && hasFirstYear !== hasSecondYear) {
    blockers.push(
      "When the number of associated companies changes across financial years, enter both the first-year and second-year counts.",
    );
  }

  if (segments.length === 1 && (hasFirstYear || hasSecondYear)) {
    blockers.push(
      "This period falls within one corporation-tax financial year, so use a single associated-companies count for the period.",
    );
  }

  return { blockers, warnings };
}

function hasMeaningfulCloseCompanyLoansSchedule(
  schedule: CloseCompanyLoansScheduleRecord | null | undefined,
) {
  if (!schedule) {
    return false;
  }

  return (
    schedule.loansMade.length > 0 ||
    schedule.reliefEarlierThan.length > 0 ||
    schedule.loanLaterReliefNow.length > 0 ||
    schedule.taxChargeable != null ||
    schedule.reliefEarlierDue != null ||
    schedule.reliefLaterDue != null ||
    schedule.totalLoansOutstanding != null
  );
}

function sumCloseCompanyLoanAmounts(
  entries: Array<{
    amountOfLoan: number;
  }>,
) {
  return roundCurrency(
    entries.reduce((total, entry) => total + entry.amountOfLoan, 0),
  );
}

function sumCloseCompanyLoanReliefAmounts(
  entries: Array<{
    amountRepaid: number | null;
    amountReleasedOrWrittenOff: number | null;
  }>,
  key: "amountRepaid" | "amountReleasedOrWrittenOff",
) {
  return roundCurrency(
    entries.reduce((total, entry) => total + (entry[key] ?? 0), 0),
  );
}

function buildCt600aReliefSection(args: {
  entries: CloseCompanyLoansScheduleRecord["reliefEarlierThan"];
  reliefDue: number | null;
}): Ct600aReliefSection | null {
  if (!args.entries.length || args.reliefDue == null || args.reliefDue <= 0) {
    return null;
  }

  const totalAmountRepaid = sumCloseCompanyLoanReliefAmounts(
    args.entries,
    "amountRepaid",
  );
  const totalAmountReleasedOrWritten = sumCloseCompanyLoanReliefAmounts(
    args.entries,
    "amountReleasedOrWrittenOff",
  );
  const totalLoans = roundCurrency(
    totalAmountRepaid + totalAmountReleasedOrWritten,
  );

  return {
    loans: args.entries.map((entry) => ({
      name: entry.name,
      amountRepaid: entry.amountRepaid,
      amountReleasedOrWrittenOff: entry.amountReleasedOrWrittenOff,
      date: entry.date,
    })),
    totalAmountRepaid: totalAmountRepaid > 0 ? totalAmountRepaid : null,
    totalAmountReleasedOrWritten:
      totalAmountReleasedOrWritten > 0 ? totalAmountReleasedOrWritten : null,
    totalLoans,
    reliefDue: roundCurrency(args.reliefDue),
  };
}

function buildCt600aSupplement(
  schedule: CloseCompanyLoansScheduleRecord | null | undefined,
): Ct600aSupplement | null {
  if (!hasMeaningfulCloseCompanyLoansSchedule(schedule)) {
    return null;
  }

  const loansInformation =
    schedule!.loansMade.length > 0 &&
    schedule!.taxChargeable != null &&
    schedule!.taxChargeable > 0
      ? {
          loans: schedule!.loansMade.map((entry) => ({
            name: entry.name,
            amountOfLoan: entry.amountOfLoan,
          })),
          totalLoans: sumCloseCompanyLoanAmounts(schedule!.loansMade),
          taxChargeable: roundCurrency(schedule!.taxChargeable),
        }
      : null;
  const reliefEarlierThan = buildCt600aReliefSection({
    entries: schedule!.reliefEarlierThan,
    reliefDue: schedule!.reliefEarlierDue,
  });
  const loanLaterReliefNow = buildCt600aReliefSection({
    entries: schedule!.loanLaterReliefNow,
    reliefDue: schedule!.reliefLaterDue,
  });
  const taxPayable = roundCurrency(
    Math.max(
      (schedule!.taxChargeable ?? 0) -
        (schedule!.reliefEarlierDue ?? 0) -
        (schedule!.reliefLaterDue ?? 0),
      0,
    ),
  );

  return {
    beforeEndPeriod: schedule!.beforeEndPeriod,
    loansInformation,
    reliefEarlierThan,
    loanLaterReliefNow,
    totalLoansOutstanding:
      schedule!.totalLoansOutstanding != null &&
      schedule!.totalLoansOutstanding > 0
        ? schedule!.totalLoansOutstanding
        : null,
    taxPayable,
  };
}

function validateCloseCompanyLoansSchedule(args: {
  schedule: CloseCompanyLoansScheduleRecord | null | undefined;
  periodEnd: string;
}) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const schedule = args.schedule;

  if (!hasMeaningfulCloseCompanyLoansSchedule(schedule)) {
    return {
      blockers,
      warnings,
      supplement: null,
    };
  }

  const periodEnd = parseISO(args.periodEnd);
  const periodEndAtMonthEnd =
    endOfMonth(periodEnd).getTime() === periodEnd.getTime();
  const today = coerceDate(new Date());
  const earlierUpperBoundExclusive = periodEndAtMonthEnd
    ? addDays(endOfMonth(addMonths(periodEnd, 9)), 1)
    : addDays(addMonths(periodEnd, 9), 1);
  const laterLowerBound = periodEndAtMonthEnd
    ? endOfMonth(addMonths(periodEnd, 9))
    : addMonths(periodEnd, 9);

  if (schedule!.loansMade.length > 0) {
    if (schedule!.taxChargeable == null || schedule!.taxChargeable <= 0) {
      blockers.push(
        "CT600A Part 1 needs a tax chargeable amount greater than zero when outstanding close-company loans are entered.",
      );
    }
  } else if (schedule!.taxChargeable != null) {
    blockers.push(
      "CT600A tax chargeable cannot be recorded unless Part 1 outstanding loans are entered.",
    );
  }

  if (schedule!.reliefEarlierThan.length > 0) {
    if (!schedule!.loansMade.length) {
      blockers.push(
        "CT600A Part 2 relief within 9 months requires Part 1 outstanding loans to be completed.",
      );
    }

    if (schedule!.reliefEarlierDue == null || schedule!.reliefEarlierDue <= 0) {
      blockers.push(
        "CT600A Part 2 needs a relief due amount greater than zero when repayment or release entries are entered.",
      );
    }
  } else if (schedule!.reliefEarlierDue != null) {
    blockers.push(
      "CT600A Part 2 relief due cannot be recorded unless Part 2 loan entries are entered.",
    );
  }

  if (schedule!.loanLaterReliefNow.length > 0) {
    if (schedule!.reliefLaterDue == null || schedule!.reliefLaterDue <= 0) {
      blockers.push(
        "CT600A Part 3 needs a relief due amount greater than zero when later relief entries are entered.",
      );
    }
  } else if (schedule!.reliefLaterDue != null) {
    blockers.push(
      "CT600A Part 3 relief due cannot be recorded unless Part 3 loan entries are entered.",
    );
  }

  if (
    schedule!.taxChargeable != null &&
    schedule!.reliefEarlierDue != null &&
    schedule!.reliefEarlierDue > schedule!.taxChargeable
  ) {
    blockers.push(
      "CT600A Part 2 relief due must not exceed the Part 1 tax chargeable amount.",
    );
  }

  if (
    schedule!.taxChargeable != null &&
    schedule!.reliefLaterDue != null &&
    schedule!.reliefLaterDue > schedule!.taxChargeable
  ) {
    blockers.push(
      "CT600A Part 3 relief due must not exceed the Part 1 tax chargeable amount.",
    );
  }

  for (const entry of schedule!.reliefEarlierThan) {
    const date = parseISO(entry.date);

    if (!isValid(date)) {
      blockers.push(
        `CT600A Part 2 date for ${entry.name} must be a valid repayment, release, or write-off date.`,
      );
      continue;
    }

    if (date.getTime() <= periodEnd.getTime()) {
      blockers.push(
        `CT600A Part 2 date for ${entry.name} must be after the accounting period end.`,
      );
    }

    if (date.getTime() >= earlierUpperBoundExclusive.getTime()) {
      blockers.push(
        `CT600A Part 2 date for ${entry.name} must fall within 9 months of the accounting period end.`,
      );
    }

    if (date.getTime() > today.getTime()) {
      blockers.push(
        `CT600A Part 2 date for ${entry.name} cannot be later than today.`,
      );
    }
  }

  for (const entry of schedule!.loanLaterReliefNow) {
    const date = parseISO(entry.date);

    if (!isValid(date)) {
      blockers.push(
        `CT600A Part 3 date for ${entry.name} must be a valid repayment, release, or write-off date.`,
      );
      continue;
    }

    if (
      periodEndAtMonthEnd
        ? date.getTime() <= laterLowerBound.getTime()
        : date.getTime() < laterLowerBound.getTime()
    ) {
      blockers.push(
        `CT600A Part 3 date for ${entry.name} must fall after the 9 month relief window.`,
      );
    }

    if (date.getTime() > today.getTime()) {
      blockers.push(
        `CT600A Part 3 date for ${entry.name} cannot be later than today.`,
      );
    }
  }

  if (
    schedule!.totalLoansOutstanding == null &&
    schedule!.loansMade.length === 0 &&
    schedule!.reliefEarlierThan.length === 0 &&
    schedule!.loanLaterReliefNow.length === 0
  ) {
    warnings.push(
      "A CT600A schedule is saved for the period but does not contain any outstanding-loan or relief rows yet.",
    );
  }

  return {
    blockers,
    warnings,
    supplement: buildCt600aSupplement(schedule),
  };
}

function buildCtComputationBreakdown(args: {
  accountingProfitBeforeTax: number;
  adjustments: Array<{
    category?: string | null;
    amount: number;
  }>;
}) {
  const groupedAdjustments = groupCorporationTaxAdjustments(args.adjustments);
  const breakdown: CtComputationBreakdown = {
    profitLossPerAccounts: roundCurrency(args.accountingProfitBeforeTax),
    depreciationAmortisationAdjustments:
      groupedAdjustments.depreciationAmortisation,
    capitalAllowancesBalancingCharges:
      groupedAdjustments.capitalAllowancesBalancingCharges,
    netTradingProfits: roundCurrency(
      args.accountingProfitBeforeTax +
        groupedAdjustments.depreciationAmortisation +
        groupedAdjustments.capitalAllowancesBalancingCharges -
        groupedAdjustments.capitalAllowances,
    ),
    totalCapitalAllowances: groupedAdjustments.capitalAllowances,
    profitsBeforeChargesAndGroupRelief: 0,
    qualifyingDonations: groupedAdjustments.charitableDonations,
    lossesBroughtForward: groupedAdjustments.lossesBroughtForward,
    groupReliefClaimed: groupedAdjustments.groupRelief,
    totalProfitsChargeableToCorporationTax: 0,
  };

  breakdown.profitsBeforeChargesAndGroupRelief = breakdown.netTradingProfits;
  breakdown.totalProfitsChargeableToCorporationTax = roundCurrency(
    breakdown.profitsBeforeChargesAndGroupRelief -
      breakdown.qualifyingDonations -
      breakdown.lossesBroughtForward -
      breakdown.groupReliefClaimed,
  );

  return {
    groupedAdjustments,
    breakdown,
  };
}

function evaluateYearEndFilingReadiness(args: {
  profile: FilingProfileRecord;
  pack: YearEndPackRecord;
  closeCompanyLoansSchedule?: CloseCompanyLoansScheduleRecord | null;
  corporationTaxRateSchedule?: CorporationTaxRateScheduleRecord | null;
  shareCapitalFromLedger: number;
  balanceSheetEquity: number;
  totalEquity: number;
  netAssets: number;
  debtBalance: number;
  accountingProfitBeforeTax: number;
  corporationTax: CorporationTaxSummary | null;
}) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const directors = normalizeDirectorList(args.profile.directors);

  if (args.pack.status === "draft") {
    blockers.push(
      "The underlying year-end pack is still in draft state. Rebuild and resolve the ledger imbalance first.",
    );
  }

  if (!args.profile.companyName) {
    blockers.push("Add the registered company name in the filing profile.");
  }

  if (!args.profile.companyNumber) {
    blockers.push(
      "Add the Companies House company number in the filing profile.",
    );
  }

  if (!args.profile.utr) {
    blockers.push("Add the corporation tax UTR in the filing profile.");
  }

  if (!args.profile.principalActivity?.trim()) {
    blockers.push("Add the principal activity for the directors' report.");
  }

  if (!directors.length) {
    blockers.push("Add at least one director name in the filing profile.");
  }

  if (!args.profile.signingDirectorName?.trim()) {
    blockers.push("Choose the director signing the financial statements.");
  } else if (!directors.includes(args.profile.signingDirectorName.trim())) {
    blockers.push(
      "The signing director must match one of the directors listed in the filing profile.",
    );
  }

  if (!args.profile.approvalDate) {
    blockers.push("Add the board approval date for the financial statements.");
  } else {
    const approvalDate = parseISO(args.profile.approvalDate);

    if (
      !isValid(approvalDate) ||
      isAfter(parseISO(args.pack.periodEnd), approvalDate)
    ) {
      blockers.push(
        "The approval date must be a valid date on or after the period end.",
      );
    }
  }

  if (args.profile.averageEmployeeCount == null) {
    blockers.push(
      "Add the average employee count for the statutory employee disclosure.",
    );
  }

  if (args.profile.dormant == null) {
    blockers.push("Confirm whether the company is dormant for this period.");
  }

  if (!args.profile.accountsPreparedUnderSmallCompaniesRegime) {
    blockers.push(
      "Confirm the accounts were prepared under the small companies regime.",
    );
  }

  if (!args.profile.auditExemptionClaimed) {
    blockers.push(
      "Confirm the section 477 small-company audit exemption statement.",
    );
  }

  if (!args.profile.membersDidNotRequireAudit) {
    blockers.push(
      "Confirm the members did not require the company to obtain an audit.",
    );
  }

  if (!args.profile.directorsAcknowledgeResponsibilities) {
    blockers.push(
      "Confirm the directors' Companies Act responsibility statement.",
    );
  }

  if (
    args.profile.ordinaryShareCount == null ||
    args.profile.ordinaryShareCount <= 0
  ) {
    blockers.push("Add the number of ordinary shares in issue.");
  }

  if (
    args.profile.ordinaryShareNominalValue == null ||
    args.profile.ordinaryShareNominalValue <= 0
  ) {
    blockers.push("Add the nominal value per ordinary share.");
  }

  if (
    args.profile.ordinaryShareCount != null &&
    args.profile.ordinaryShareNominalValue != null
  ) {
    const expectedShareCapital = roundCurrency(
      args.profile.ordinaryShareCount * args.profile.ordinaryShareNominalValue,
    );

    if (Math.abs(expectedShareCapital - args.shareCapitalFromLedger) > 0.009) {
      blockers.push(
        "Ordinary share count and nominal value do not tie to the ledger share-capital balance.",
      );
    }
  }

  if (Math.abs(args.balanceSheetEquity - args.totalEquity) > 0.009) {
    blockers.push(
      "Additional equity reserves are present outside ordinary share capital and retained earnings. That reserve structure is not yet supported by the filing-ready small-company path.",
    );
  }

  if (
    args.profile.dormant &&
    (Math.abs(args.netAssets) > 0.009 ||
      Math.abs(args.accountingProfitBeforeTax) > 0.009 ||
      Math.abs(args.corporationTax?.estimatedCorporationTaxDue ?? 0) > 0.009)
  ) {
    blockers.push(
      "The filing profile marks the company as dormant, but the current year-end pack shows trading activity or balances.",
    );
  }

  if (Math.abs(args.debtBalance) > 0.009) {
    blockers.push(
      "Debt balances still need maturity splitting and note support before the pack can be treated as filing-ready.",
    );
  }

  if (Math.abs(args.netAssets - args.totalEquity) > 0.009) {
    blockers.push(
      "Net assets do not tie back to capital and reserves. Review the equity mapping before filing.",
    );
  }

  const computation = buildCtComputationBreakdown({
    accountingProfitBeforeTax: args.accountingProfitBeforeTax,
    adjustments: args.corporationTax?.adjustments ?? [],
  });

  if (Math.abs(computation.groupedAdjustments.other) > 0.009) {
    blockers.push(
      "At least one corporation-tax adjustment is still in the unsupported 'other' category. Reclassify it to use the filing-ready CT computation path.",
    );
  }

  for (const adjustment of args.corporationTax?.adjustments ?? []) {
    switch (adjustment.category) {
      case "depreciation_amortisation":
      case "capital_allowances_balancing_charges":
        if (adjustment.amount < 0) {
          blockers.push(
            `${adjustment.label} is using a negative amount, but its category must increase taxable profits.`,
          );
        }
        break;
      case "charitable_donations":
      case "capital_allowances":
      case "losses_brought_forward":
      case "group_relief":
        if (adjustment.amount > 0) {
          blockers.push(
            `${adjustment.label} is using a positive amount, but its category must reduce taxable profits.`,
          );
        }
        break;
      default:
        break;
    }
  }

  const expectedTaxableProfit =
    computation.breakdown.totalProfitsChargeableToCorporationTax;
  const recordedTaxableProfit = roundCurrency(
    args.corporationTax?.taxableProfit ?? expectedTaxableProfit,
  );

  if (expectedTaxableProfit < -0.009) {
    blockers.push(
      "The structured CT computation produces negative chargeable profits. Loss-making filings remain outside the supported filing-ready path.",
    );
  }

  if (Math.abs(expectedTaxableProfit - recordedTaxableProfit) > 0.009) {
    blockers.push(
      "The structured CT computation does not tie to the taxable-profit total in the year-end pack.",
    );
  }

  if (
    args.corporationTax &&
    Math.abs(
      args.corporationTax.accountingProfitBeforeTax -
        args.accountingProfitBeforeTax,
    ) > 0.009
  ) {
    warnings.push(
      "The CT summary uses an accounting-profit figure that no longer matches the profit and loss schedule. Rebuild the pack before submitting.",
    );
  }

  const closeCompanyLoansEvaluation = validateCloseCompanyLoansSchedule({
    schedule: args.closeCompanyLoansSchedule,
    periodEnd: args.pack.periodEnd,
  });
  const corporationTaxRateEvaluation = validateCorporationTaxRateSchedule({
    schedule: args.corporationTaxRateSchedule,
    periodStart: args.pack.periodStart,
    periodEnd: args.pack.periodEnd,
  });

  blockers.push(...closeCompanyLoansEvaluation.blockers);
  warnings.push(...closeCompanyLoansEvaluation.warnings);
  blockers.push(...corporationTaxRateEvaluation.blockers);
  warnings.push(...corporationTaxRateEvaluation.warnings);

  return {
    directors,
    computationBreakdown: computation.breakdown,
    filingReadiness: createFilingReadiness(blockers, warnings),
  };
}

function buildEmptyYearEndDashboard(args: {
  team: TeamContext;
  profile: FilingProfileRecord | null;
}) {
  return {
    enabled: isUkComplianceVisible({
      countryCode: args.team.countryCode,
      profileEnabled: args.profile?.enabled,
    }),
    team: args.team,
    profile: args.profile,
    period: null,
    pack: null,
    ctRuntime: getHmrcCtRuntimeStatus(args.profile),
    manualJournalCount: 0,
    corporationTaxAdjustmentCount: 0,
    latestExportedAt: null,
  };
}

function getHmrcCtEnvironment(): HmrcCtEnvironment {
  return process.env.HMRC_CT_ENVIRONMENT === "production"
    ? "production"
    : "test";
}

function getHmrcCtRuntimeStatus(
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

function assertUkComplianceEnabled(
  team: TeamContext,
  profile?: { enabled: boolean } | null,
) {
  const visible = isUkComplianceVisible({
    countryCode: team.countryCode,
    profileEnabled: profile?.enabled,
  });

  if (!visible) {
    throw new Error("UK compliance is not enabled for this team");
  }
}

async function getTeamContext(
  db: Database,
  teamId: string,
): Promise<TeamContext> {
  const team = await getTeamById(db, teamId);

  if (!team) {
    throw new Error("Team not found");
  }

  return {
    id: team.id,
    name: team.name,
    countryCode: team.countryCode,
    baseCurrency: team.baseCurrency,
  };
}

function getAccountCatalog() {
  return new Map(
    UK_SYSTEM_LEDGER_ACCOUNTS.map((account) => [account.code, account]),
  );
}

function inferAccountType(accountCode: string): LedgerAccountType {
  const leadingDigit = accountCode.trim()[0];

  switch (leadingDigit) {
    case "1":
      return "asset";
    case "2":
      return "liability";
    case "3":
      return "equity";
    case "4":
      return "income";
    default:
      return "expense";
  }
}

function describeAccount(accountCode: string) {
  const account = getAccountCatalog().get(accountCode);

  return {
    accountName: account?.name ?? `Account ${accountCode}`,
    accountType: account?.type ?? inferAccountType(accountCode),
  };
}

function coerceDate(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function resolveYearEndDate(year: number, month: number, day: number) {
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDayOfMonth);

  return new Date(Date.UTC(year, month - 1, safeDay));
}

function resolveReferenceDate(referenceDate?: Date) {
  if (referenceDate && isValid(referenceDate)) {
    return coerceDate(referenceDate);
  }

  return coerceDate(new Date());
}

function formatDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function resolveAnnualPeriod(
  profile: Pick<FilingProfileRecord, "yearEndMonth" | "yearEndDay">,
  options?: {
    periodKey?: string;
    referenceDate?: Date;
  },
): AnnualPeriod {
  const yearEndMonth = profile.yearEndMonth ?? 3;
  const yearEndDay = profile.yearEndDay ?? 31;

  let periodEnd: Date;

  if (options?.periodKey) {
    periodEnd = coerceDate(parseISO(options.periodKey));

    if (!isValid(periodEnd)) {
      throw new Error("Invalid year-end period key");
    }
  } else {
    const referenceDate = resolveReferenceDate(options?.referenceDate);
    const referenceYear = referenceDate.getUTCFullYear();
    const candidate = resolveYearEndDate(
      referenceYear,
      yearEndMonth,
      yearEndDay,
    );
    periodEnd = isAfter(referenceDate, candidate)
      ? resolveYearEndDate(referenceYear + 1, yearEndMonth, yearEndDay)
      : candidate;
  }

  const previousYearEnd = resolveYearEndDate(
    periodEnd.getUTCFullYear() - 1,
    yearEndMonth,
    yearEndDay,
  );
  const periodStart = addDays(previousYearEnd, 1);
  const accountsDueDate = addMonths(periodEnd, 9);
  const corporationTaxDueDate = addDays(addMonths(periodEnd, 9), 1);

  return {
    periodKey: formatDateKey(periodEnd),
    periodStart: formatDateKey(periodStart),
    periodEnd: formatDateKey(periodEnd),
    accountsDueDate: formatDateKey(accountsDueDate),
    corporationTaxDueDate: formatDateKey(corporationTaxDueDate),
  };
}

function determineObligationStatus(dueDate: string) {
  const today = format(new Date(), "yyyy-MM-dd");
  return today > dueDate ? "overdue" : "open";
}

async function ensureAnnualObligations(
  teamId: string,
  profile: FilingProfileRecord,
  period: AnnualPeriod,
): Promise<YearEndPeriodContext["obligations"]> {
  const [accounts, corporationTax] = await Promise.all([
    upsertComplianceObligationInConvex({
      teamId,
      filingProfileId: profile.id,
      provider: "companies-house",
      obligationType: "accounts",
      periodKey: period.periodKey,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      dueDate: period.accountsDueDate,
      status: determineObligationStatus(period.accountsDueDate),
      externalId: `${profile.id}:accounts:${period.periodKey}`,
      raw: {
        generatedBy: "tamias",
        kind: "annual_internal_obligation",
      },
    }),
    upsertComplianceObligationInConvex({
      teamId,
      filingProfileId: profile.id,
      provider: "hmrc-ct",
      obligationType: "corporation_tax",
      periodKey: period.periodKey,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      dueDate: period.corporationTaxDueDate,
      status: determineObligationStatus(period.corporationTaxDueDate),
      externalId: `${profile.id}:corporation_tax:${period.periodKey}`,
      raw: {
        generatedBy: "tamias",
        kind: "annual_internal_obligation",
      },
    }),
  ]);

  return {
    accounts,
    corporationTax,
  };
}

function presentBalance(accountType: LedgerAccountType, balance: number) {
  switch (accountType) {
    case "liability":
    case "equity":
    case "income":
      return roundCurrency(balance * -1);
    default:
      return roundCurrency(balance);
  }
}

function buildTrialBalance(
  entries: ComplianceJournalEntryRecord[],
  periodStart: string,
  periodEnd: string,
) {
  const totals = new Map<
    string,
    {
      debit: number;
      credit: number;
      accountName: string;
      accountType: LedgerAccountType;
    }
  >();

  for (const entry of entries) {
    for (const line of entry.lines) {
      const descriptor = describeAccount(line.accountCode);

      if (
        (descriptor.accountType === "income" ||
          descriptor.accountType === "expense") &&
        (entry.entryDate < periodStart || entry.entryDate > periodEnd)
      ) {
        continue;
      }

      if (
        (descriptor.accountType === "asset" ||
          descriptor.accountType === "liability" ||
          descriptor.accountType === "equity") &&
        entry.entryDate > periodEnd
      ) {
        continue;
      }

      const existing = totals.get(line.accountCode) ?? {
        debit: 0,
        credit: 0,
        accountName: descriptor.accountName,
        accountType: descriptor.accountType,
      };

      existing.debit = roundCurrency(existing.debit + (line.debit ?? 0));
      existing.credit = roundCurrency(existing.credit + (line.credit ?? 0));
      totals.set(line.accountCode, existing);
    }
  }

  return [...totals.entries()]
    .map(([accountCode, totalsForAccount]) => ({
      accountCode,
      accountName: totalsForAccount.accountName,
      accountType: totalsForAccount.accountType,
      debit: roundCurrency(totalsForAccount.debit),
      credit: roundCurrency(totalsForAccount.credit),
      balance: roundCurrency(totalsForAccount.debit - totalsForAccount.credit),
    }))
    .sort((left, right) => left.accountCode.localeCompare(right.accountCode));
}

function sumPresentedBalances(
  lines: TrialBalanceLine[],
  accountTypes: LedgerAccountType[],
) {
  return roundCurrency(
    lines
      .filter((line) => accountTypes.includes(line.accountType))
      .reduce(
        (total, line) => total + presentBalance(line.accountType, line.balance),
        0,
      ),
  );
}

function buildProfitAndLoss(trialBalance: TrialBalanceLine[]): SummaryLine[] {
  const revenue = sumPresentedBalances(trialBalance, ["income"]);
  const expenses = sumPresentedBalances(trialBalance, ["expense"]);
  const profitBeforeTax = roundCurrency(revenue - expenses);

  return [
    { key: "revenue", label: "Revenue", amount: revenue },
    { key: "expenses", label: "Expenses", amount: expenses * -1 },
    {
      key: "profit_before_tax",
      label: "Profit before tax",
      amount: profitBeforeTax,
    },
  ];
}

function buildBalanceSheet(
  trialBalance: TrialBalanceLine[],
  retainedEarnings: RetainedEarningsRollforward,
): SummaryLine[] {
  const assets = sumPresentedBalances(trialBalance, ["asset"]);
  const liabilities = sumPresentedBalances(trialBalance, ["liability"]);
  const shareCapital = trialBalance
    .filter(
      (line) => line.accountType === "equity" && line.accountCode === "3000",
    )
    .reduce(
      (total, line) => total + presentBalance(line.accountType, line.balance),
      0,
    );
  const otherEquity = trialBalance
    .filter(
      (line) =>
        line.accountType === "equity" &&
        line.accountCode !== "3000" &&
        line.accountCode !== "3100",
    )
    .reduce(
      (total, line) => total + presentBalance(line.accountType, line.balance),
      0,
    );
  const equity = roundCurrency(
    shareCapital + retainedEarnings.closingBalance + otherEquity,
  );

  return [
    { key: "assets", label: "Assets", amount: assets },
    { key: "liabilities", label: "Liabilities", amount: liabilities },
    { key: "equity", label: "Equity", amount: equity },
  ];
}

function buildWorkingPapers(
  trialBalance: TrialBalanceLine[],
): WorkingPaperSection[] {
  const sectionMatchers: Array<{
    key: WorkingPaperSection["key"];
    label: string;
    matches: (line: TrialBalanceLine) => boolean;
  }> = [
    {
      key: "bank",
      label: "Bank",
      matches: (line) => line.accountCode === "1000",
    },
    {
      key: "receivables",
      label: "Receivables",
      matches: (line) => line.accountCode === "1100",
    },
    {
      key: "payables",
      label: "Payables",
      matches: (line) =>
        line.accountCode === "2000" || line.accountCode === "2100",
    },
    {
      key: "vat",
      label: "VAT",
      matches: (line) =>
        line.accountCode === "1200" || line.accountCode === "2200",
    },
    {
      key: "debt",
      label: "Debt",
      matches: (line) => line.accountCode === "2400",
    },
    {
      key: "equity",
      label: "Equity",
      matches: (line) =>
        line.accountCode === "3000" || line.accountCode === "3100",
    },
    {
      key: "tax_accruals",
      label: "Tax accruals",
      matches: (line) =>
        line.accountCode === "2210" || line.accountCode === "2300",
    },
  ];

  return sectionMatchers.map((section) => {
    const lines = trialBalance.filter(section.matches).map((line) => ({
      accountCode: line.accountCode,
      accountName: line.accountName,
      accountType: line.accountType,
      balance: presentBalance(line.accountType, line.balance),
    }));

    return {
      key: section.key,
      label: section.label,
      total: roundCurrency(
        lines.reduce((total, line) => total + roundCurrency(line.balance), 0),
      ),
      lines,
    };
  });
}

function buildRetainedEarnings(
  entries: ComplianceJournalEntryRecord[],
  periodStart: string,
  periodEnd: string,
  profitAndLoss: SummaryLine[],
): RetainedEarningsRollforward {
  const retainedEntries = entries.flatMap((entry) =>
    entry.lines
      .filter((line) => line.accountCode === "3100")
      .map((line) => ({ entryDate: entry.entryDate, line })),
  );

  const openingBalance = roundCurrency(
    retainedEntries
      .filter((row) => row.entryDate < periodStart)
      .reduce(
        (total, row) =>
          total +
          presentBalance(
            "equity",
            (row.line.debit ?? 0) - (row.line.credit ?? 0),
          ),
        0,
      ),
  );

  const manualEquityAdjustments = roundCurrency(
    retainedEntries
      .filter(
        (row) => row.entryDate >= periodStart && row.entryDate <= periodEnd,
      )
      .reduce(
        (total, row) =>
          total +
          presentBalance(
            "equity",
            (row.line.debit ?? 0) - (row.line.credit ?? 0),
          ),
        0,
      ),
  );

  const currentPeriodProfit =
    profitAndLoss.find((line) => line.key === "profit_before_tax")?.amount ?? 0;

  return {
    openingBalance,
    currentPeriodProfit,
    manualEquityAdjustments,
    closingBalance: roundCurrency(
      openingBalance + currentPeriodProfit + manualEquityAdjustments,
    ),
  };
}

function buildCorporationTaxSummary(
  period: AnnualPeriod,
  profitAndLoss: SummaryLine[],
  adjustments: CorporationTaxAdjustmentRecord[],
  rateSchedule?: CorporationTaxRateScheduleRecord | null,
): CorporationTaxSummary {
  const accountingProfitBeforeTax =
    profitAndLoss.find((line) => line.key === "profit_before_tax")?.amount ?? 0;
  const manualAdjustmentsTotal = roundCurrency(
    adjustments.reduce((total, adjustment) => total + adjustment.amount, 0),
  );
  const taxableProfit = roundCurrency(
    accountingProfitBeforeTax + manualAdjustmentsTotal,
  );
  const rateSummary = buildCorporationTaxRateSummary({
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    chargeableProfits: taxableProfit,
    rateSchedule,
  });

  return {
    accountingProfitBeforeTax,
    manualAdjustmentsTotal,
    taxableProfit,
    estimatedTaxRate: rateSummary.effectiveTaxRate,
    estimatedCorporationTaxDue: rateSummary.netCorporationTaxDue,
    grossCorporationTaxDue: rateSummary.grossCorporationTaxDue,
    marginalRelief: rateSummary.marginalRelief,
    exemptDistributions: rateSummary.exemptDistributions,
    augmentedProfits: rateSummary.augmentedProfits,
    startingOrSmallCompaniesRate: rateSummary.startingOrSmallCompaniesRate,
    associatedCompaniesMode: rateSummary.associatedCompaniesMode,
    associatedCompaniesThisPeriod: rateSummary.associatedCompaniesThisPeriod,
    associatedCompaniesFirstYear: rateSummary.associatedCompaniesFirstYear,
    associatedCompaniesSecondYear: rateSummary.associatedCompaniesSecondYear,
    financialYears: rateSummary.financialYears,
    adjustments: adjustments.map((adjustment) => ({
      id: adjustment.id,
      category: adjustment.category,
      label: adjustment.label,
      amount: adjustment.amount,
      note: adjustment.note,
      createdAt: adjustment.createdAt,
    })),
  };
}

function buildSnapshotChecksum(payload: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function buildYearEndPackSnapshot(args: {
  entries: ComplianceJournalEntryRecord[];
  period: AnnualPeriod;
  adjustments: CorporationTaxAdjustmentRecord[];
  rateSchedule?: CorporationTaxRateScheduleRecord | null;
  exportBundles?: ExportBundleRecord[];
  latestExportedAt?: string | null;
  currency: string;
}): {
  currency: string;
  trialBalance: TrialBalanceLine[];
  profitAndLoss: SummaryLine[];
  balanceSheet: SummaryLine[];
  retainedEarnings: RetainedEarningsRollforward;
  workingPapers: WorkingPaperSection[];
  corporationTax: CorporationTaxSummary;
  exportBundles: ExportBundleRecord[];
  latestExportedAt: string | null;
  status: "draft" | "ready" | "exported";
  snapshotChecksum: string;
} {
  const trialBalance = buildTrialBalance(
    args.entries,
    args.period.periodStart,
    args.period.periodEnd,
  );
  const profitAndLoss = buildProfitAndLoss(trialBalance);
  const retainedEarnings = buildRetainedEarnings(
    args.entries,
    args.period.periodStart,
    args.period.periodEnd,
    profitAndLoss,
  );
  const balanceSheet = buildBalanceSheet(trialBalance, retainedEarnings);
  const workingPapers = buildWorkingPapers(trialBalance);
  const corporationTax = buildCorporationTaxSummary(
    args.period,
    profitAndLoss,
    args.adjustments,
    args.rateSchedule,
  );
  const snapshotPayload = {
    period: args.period,
    currency: args.currency,
    trialBalance,
    profitAndLoss,
    balanceSheet,
    retainedEarnings,
    workingPapers,
    corporationTax,
  };
  const trialBalanceDifference = roundCurrency(
    trialBalance.reduce(
      (total, line) => total + roundCurrency(line.debit - line.credit),
      0,
    ),
  );

  return {
    currency: args.currency,
    trialBalance,
    profitAndLoss,
    balanceSheet,
    retainedEarnings,
    workingPapers,
    corporationTax,
    exportBundles: args.exportBundles ?? [],
    latestExportedAt: args.latestExportedAt ?? null,
    status:
      Math.abs(trialBalanceDifference) > 0.009
        ? "draft"
        : (args.exportBundles?.length ?? 0) > 0
          ? "exported"
          : "ready",
    snapshotChecksum: buildSnapshotChecksum(snapshotPayload),
  };
}

async function getYearEndContext(
  db: Database,
  teamId: string,
  periodKey?: string,
) {
  const team = await getTeamContext(db, teamId);
  const profile = await getFilingProfile(db, teamId);

  if (!profile) {
    throw new Error("Filing profile not configured");
  }

  assertUkComplianceEnabled(team, profile);

  const period = resolveAnnualPeriod(profile, { periodKey });
  const obligations = await ensureAnnualObligations(teamId, profile, period);

  return {
    team,
    profile,
    period: {
      ...period,
      obligations,
    },
  };
}

async function loadLedgerEntries(
  db: Database,
  params: {
    teamId: string;
    team: TeamContext;
    profile: FilingProfileRecord;
  },
) {
  const derivedEntries = await rebuildDerivedLedger(db, params);
  const otherEntries = await listComplianceJournalEntriesFromConvex({
    teamId: params.teamId,
    sourceTypes: ["manual_adjustment", "payroll_import"],
  });

  return [...derivedEntries, ...otherEntries];
}

function filterManualJournalsForPeriod(
  entries: ComplianceJournalEntryRecord[],
  period: AnnualPeriod,
) {
  return entries.filter(
    (entry) =>
      entry.sourceType === "manual_adjustment" &&
      entry.entryDate >= period.periodStart &&
      entry.entryDate <= period.periodEnd,
  );
}

function filterPayrollRunsForPeriod(
  runs: PayrollRunRecord[],
  period: AnnualPeriod,
) {
  return runs.filter(
    (run) =>
      run.payPeriodEnd >= period.periodStart &&
      run.payPeriodEnd <= period.periodEnd,
  );
}

function validateBalancedLines(
  lines: Array<
    Pick<ComplianceJournalLineRecord, "accountCode" | "debit" | "credit">
  >,
) {
  if (lines.length < 2) {
    throw new Error("At least two journal lines are required");
  }

  const totalDebit = roundCurrency(
    lines.reduce((total, line) => total + (line.debit ?? 0), 0),
  );
  const totalCredit = roundCurrency(
    lines.reduce((total, line) => total + (line.credit ?? 0), 0),
  );

  if (totalDebit <= 0 || totalCredit <= 0) {
    throw new Error("Journal lines must include both debit and credit values");
  }

  if (Math.abs(totalDebit - totalCredit) > 0.009) {
    throw new Error("Journal entry must balance");
  }
}

function buildYearEndWorkspacePayload(args: {
  team: TeamContext;
  profile: FilingProfileRecord;
  period: YearEndPeriodContext;
  pack: YearEndPackRecord | null;
  manualJournals: ComplianceJournalEntryRecord[];
  corporationTaxAdjustments: CorporationTaxAdjustmentRecord[];
  closeCompanyLoansSchedule: CloseCompanyLoansScheduleRecord | null;
  corporationTaxRateSchedule: CorporationTaxRateScheduleRecord | null;
}) {
  const statutoryAccountsDraft = args.pack
    ? buildStatutoryAccountsDraft({
        team: args.team,
        profile: args.profile,
        pack: args.pack,
        closeCompanyLoansSchedule: args.closeCompanyLoansSchedule,
        corporationTaxRateSchedule: args.corporationTaxRateSchedule,
      })
    : null;
  const ct600Draft = args.pack
    ? buildCt600Draft({
        team: args.team,
        profile: args.profile,
        pack: args.pack,
        closeCompanyLoansSchedule: args.closeCompanyLoansSchedule,
        corporationTaxRateSchedule: args.corporationTaxRateSchedule,
      })
    : null;

  return {
    profile: args.profile,
    period: args.period,
    pack: args.pack,
    manualJournals: args.manualJournals,
    corporationTaxAdjustments: args.corporationTaxAdjustments,
    closeCompanyLoansSchedule: args.closeCompanyLoansSchedule,
    corporationTaxRateSchedule: args.corporationTaxRateSchedule,
    filingReadiness: statutoryAccountsDraft?.filingReadiness ?? null,
    statutoryAccountsDraft,
    ct600Draft,
  };
}

export async function getYearEndDashboard(
  db: Database,
  params: { teamId: string; periodKey?: string },
) {
  const team = await getTeamContext(db, params.teamId);
  const profile = await getFilingProfile(db, params.teamId);

  if (!profile) {
    return buildEmptyYearEndDashboard({
      team,
      profile,
    });
  }

  const context = await getYearEndContext(db, params.teamId, params.periodKey);
  const [existingPack, manualEntries, corporationTaxAdjustments] =
    await Promise.all([
      getYearEndPackByPeriodFromConvex({
        teamId: params.teamId,
        filingProfileId: context.profile.id,
        periodKey: context.period.periodKey,
      }),
      listComplianceJournalEntriesFromConvex({
        teamId: params.teamId,
        sourceTypes: ["manual_adjustment"],
      }),
      listCorporationTaxAdjustmentsForPeriodFromConvex({
        teamId: params.teamId,
        filingProfileId: context.profile.id,
        periodKey: context.period.periodKey,
      }),
    ]);

  const manualJournals = filterManualJournalsForPeriod(
    manualEntries,
    context.period,
  );

  return {
    enabled: true,
    team: context.team,
    profile: context.profile,
    period: context.period,
    pack: existingPack,
    ctRuntime: getHmrcCtRuntimeStatus(context.profile),
    manualJournalCount:
      existingPack?.manualJournalCount ?? manualJournals.length,
    corporationTaxAdjustmentCount:
      existingPack?.corporationTax &&
      typeof existingPack.corporationTax === "object" &&
      existingPack.corporationTax !== null &&
      "adjustments" in existingPack.corporationTax &&
      Array.isArray(
        (existingPack.corporationTax as { adjustments?: unknown[] })
          .adjustments,
      )
        ? (existingPack.corporationTax as { adjustments: unknown[] })
            .adjustments.length
        : corporationTaxAdjustments.length,
    latestExportedAt: existingPack?.latestExportedAt ?? null,
  };
}

export async function getYearEndPack(
  db: Database,
  params: { teamId: string; periodKey?: string },
) {
  const context = await getYearEndContext(db, params.teamId, params.periodKey);
  const [
    pack,
    manualEntries,
    corporationTaxAdjustments,
    closeCompanyLoansSchedule,
    corporationTaxRateSchedule,
  ] = await Promise.all([
    getYearEndPackByPeriodFromConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      periodKey: context.period.periodKey,
    }),
    listComplianceJournalEntriesFromConvex({
      teamId: params.teamId,
      sourceTypes: ["manual_adjustment"],
    }),
    listCorporationTaxAdjustmentsForPeriodFromConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      periodKey: context.period.periodKey,
    }),
    getCloseCompanyLoansScheduleByPeriodFromConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      periodKey: context.period.periodKey,
    }),
    getCorporationTaxRateScheduleByPeriodFromConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      periodKey: context.period.periodKey,
    }),
  ]);

  return buildYearEndWorkspacePayload({
    team: context.team,
    profile: context.profile,
    period: context.period,
    pack,
    manualJournals: filterManualJournalsForPeriod(
      manualEntries,
      context.period,
    ),
    corporationTaxAdjustments,
    closeCompanyLoansSchedule,
    corporationTaxRateSchedule,
  });
}

export async function rebuildYearEndPack(
  db: Database,
  params: { teamId: string; periodKey?: string },
) {
  const context = await getYearEndContext(db, params.teamId, params.periodKey);
  const [
    corporationTaxAdjustments,
    existingPack,
    payrollRuns,
    closeCompanyLoansSchedule,
    corporationTaxRateSchedule,
  ] = await Promise.all([
    listCorporationTaxAdjustmentsForPeriodFromConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      periodKey: context.period.periodKey,
    }),
    getYearEndPackByPeriodFromConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      periodKey: context.period.periodKey,
    }),
    listPayrollRunsFromConvex({
      teamId: params.teamId,
    }),
    getCloseCompanyLoansScheduleByPeriodFromConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      periodKey: context.period.periodKey,
    }),
    getCorporationTaxRateScheduleByPeriodFromConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      periodKey: context.period.periodKey,
    }),
  ]);

  const entries = await loadLedgerEntries(db, {
    teamId: params.teamId,
    team: context.team,
    profile: context.profile,
  });
  const manualJournals = filterManualJournalsForPeriod(entries, context.period);
  const payrollRunsInPeriod = filterPayrollRunsForPeriod(
    payrollRuns,
    context.period,
  );
  const snapshot = buildYearEndPackSnapshot({
    entries,
    period: context.period,
    adjustments: corporationTaxAdjustments,
    rateSchedule: corporationTaxRateSchedule,
    exportBundles: existingPack?.exportBundles,
    latestExportedAt: existingPack?.latestExportedAt,
    currency:
      context.profile.baseCurrency ?? context.team.baseCurrency ?? "GBP",
  });

  const pack = await upsertYearEndPackInConvex({
    id: existingPack?.id,
    teamId: params.teamId,
    filingProfileId: context.profile.id,
    periodKey: context.period.periodKey,
    periodStart: context.period.periodStart,
    periodEnd: context.period.periodEnd,
    accountsDueDate: context.period.accountsDueDate,
    corporationTaxDueDate: context.period.corporationTaxDueDate,
    status: snapshot.status,
    currency: snapshot.currency,
    trialBalance: snapshot.trialBalance,
    profitAndLoss: snapshot.profitAndLoss,
    balanceSheet: snapshot.balanceSheet,
    retainedEarnings: snapshot.retainedEarnings,
    workingPapers: snapshot.workingPapers,
    corporationTax: snapshot.corporationTax,
    manualJournalCount: manualJournals.length,
    payrollRunCount: payrollRunsInPeriod.length,
    exportBundles: snapshot.exportBundles,
    latestExportedAt: snapshot.latestExportedAt,
    snapshotChecksum: snapshot.snapshotChecksum,
  });

  return buildYearEndWorkspacePayload({
    team: context.team,
    profile: context.profile,
    period: context.period,
    pack,
    manualJournals,
    corporationTaxAdjustments,
    closeCompanyLoansSchedule,
    corporationTaxRateSchedule,
  });
}

function buildCsvChecksum(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function buildZipBundle(files: Array<{ name: string; data: Buffer }>) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = new PassThrough();

    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", reject);
    archive.pipe(stream);

    for (const file of files) {
      archive.append(file.data, { name: file.name });
    }

    archive.finalize();
  });
}

async function createSubmissionArtifactBundle(args: {
  teamId: string;
  scope: "corporation-tax";
  periodKey: string;
  files: Array<{ name: string; data: Buffer }>;
  manifest: Record<string, unknown>;
}) {
  const zipBuffer = await buildZipBundle([
    ...args.files,
    {
      name: "manifest.json",
      data: Buffer.from(JSON.stringify(args.manifest, null, 2), "utf8"),
    },
  ]);
  const generatedAt = new Date().toISOString();
  const timestampToken = generatedAt.replaceAll(/[:.]/g, "-");
  const fileName = `${args.scope}-${args.periodKey}-${timestampToken}.zip`;
  const filePath = `${args.teamId}/compliance/submissions/${args.scope}/${args.periodKey}/${fileName}`;
  const uploadResult = await uploadVaultFile({
    path: filePath,
    blob: zipBuffer,
    contentType: "application/zip",
    size: zipBuffer.length,
  });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  return {
    filePath,
    fileName,
    generatedAt,
    checksum: createHash("sha256").update(zipBuffer).digest("hex"),
  } satisfies SubmissionArtifactBundleRecord;
}

function parsePackArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getSummaryAmount(lines: SummaryLine[], key: string) {
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

function formatDraftDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatDraftAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function humanizeToken(value: string) {
  return value
    .replaceAll(/[_-]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildStatutoryAccountsDraft(args: {
  team: TeamContext;
  profile: FilingProfileRecord;
  pack: YearEndPackRecord;
  closeCompanyLoansSchedule?: CloseCompanyLoansScheduleRecord | null;
  corporationTaxRateSchedule?: CorporationTaxRateScheduleRecord | null;
  generatedAt?: string;
}): StatutoryAccountsDraft {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const profitAndLoss = parsePackArray<SummaryLine>(args.pack.profitAndLoss);
  const balanceSheet = parsePackArray<SummaryLine>(args.pack.balanceSheet);
  const workingPapers = parsePackArray<WorkingPaperSection>(
    args.pack.workingPapers,
  );
  const retainedEarnings = (args.pack
    .retainedEarnings as RetainedEarningsRollforward | null) ?? {
    openingBalance: 0,
    currentPeriodProfit: 0,
    manualEquityAdjustments: 0,
    closingBalance: 0,
  };
  const corporationTax =
    (args.pack.corporationTax as CorporationTaxSummary | null) ?? null;

  const equitySection = getWorkingPaperSection(workingPapers, "equity");
  const debtSection = getWorkingPaperSection(workingPapers, "debt");
  const shareCapital = getWorkingPaperLineAmount(equitySection, "3000");
  const retainedReserve = retainedEarnings.closingBalance;
  const assets = getSummaryAmount(balanceSheet, "assets");
  const liabilities = getSummaryAmount(balanceSheet, "liabilities");
  const balanceSheetEquity = getSummaryAmount(balanceSheet, "equity");
  const otherReserves = roundCurrency(
    balanceSheetEquity - shareCapital - retainedReserve,
  );
  const totalEquity = roundCurrency(
    shareCapital + retainedReserve + otherReserves,
  );
  const netAssets = roundCurrency(assets - liabilities);
  const accountingProfitBeforeTax =
    corporationTax?.accountingProfitBeforeTax ??
    getSummaryAmount(profitAndLoss, "profit_before_tax");
  const evaluation = evaluateYearEndFilingReadiness({
    profile: args.profile,
    pack: args.pack,
    closeCompanyLoansSchedule: args.closeCompanyLoansSchedule,
    corporationTaxRateSchedule: args.corporationTaxRateSchedule,
    shareCapitalFromLedger: shareCapital,
    balanceSheetEquity,
    totalEquity,
    netAssets,
    debtBalance: debtSection?.total ?? 0,
    accountingProfitBeforeTax,
    corporationTax,
  });
  const reviewItems = [
    "The standalone draft HTML is for review only. Use the generated iXBRL attachment for CT submission workflows.",
    ...evaluation.filingReadiness.warnings,
  ];

  if (!evaluation.filingReadiness.isReady) {
    reviewItems.push(...evaluation.filingReadiness.blockers);
  }

  return {
    generatedAt,
    companyName:
      args.profile.companyName ?? args.team.name ?? "Unnamed company",
    companyNumber: args.profile.companyNumber,
    periodStart: args.pack.periodStart,
    periodEnd: args.pack.periodEnd,
    accountsDueDate: args.pack.accountsDueDate,
    currency: args.pack.currency,
    accountingBasis: args.profile.accountingBasis,
    principalActivity: args.profile.principalActivity,
    directors: evaluation.directors,
    signingDirectorName: args.profile.signingDirectorName,
    approvalDate: args.profile.approvalDate,
    averageEmployeeCount: args.profile.averageEmployeeCount,
    ordinaryShareCount: args.profile.ordinaryShareCount,
    ordinaryShareNominalValue: args.profile.ordinaryShareNominalValue,
    dormant: args.profile.dormant,
    auditExemptionClaimed: args.profile.auditExemptionClaimed,
    membersDidNotRequireAudit: args.profile.membersDidNotRequireAudit,
    directorsAcknowledgeResponsibilities:
      args.profile.directorsAcknowledgeResponsibilities,
    accountsPreparedUnderSmallCompaniesRegime:
      args.profile.accountsPreparedUnderSmallCompaniesRegime,
    statementOfFinancialPosition: {
      assets,
      liabilities,
      netAssets,
      shareCapital,
      retainedEarnings: retainedReserve,
      otherReserves,
      totalEquity,
    },
    profitAndLoss,
    balanceSheet,
    retainedEarnings,
    corporationTax,
    workingPaperNotes: workingPapers
      .filter((section) => section.lines.length > 0)
      .map((section) => ({
        key: section.key,
        label: section.label,
        total: section.total,
        lines: section.lines.map((line) => ({
          label: `${line.accountName} (${line.accountCode})`,
          amount: line.balance,
        })),
      })),
    reviewItems,
    limitations: evaluation.filingReadiness.isReady
      ? [
          `This pack is filing-ready for the supported path: ${SUPPORTED_SMALL_COMPANY_FILING_PATH}.`,
          "CT600A and HMRC marginal relief are supported. Other supplementary pages, complex tax reliefs, and non-small-company reporting regimes remain outside the supported path.",
        ]
      : [
          "This draft is assembled from the Tamias year-end pack and explicit filing-profile facts.",
          "Until every blocker is cleared, treat the attachment as a non-filing-ready draft.",
          "CT600A and HMRC marginal relief are supported. Other supplementary pages, complex tax reliefs, and non-small-company reporting regimes remain outside the supported path.",
        ],
    filingReadiness: evaluation.filingReadiness,
  };
}

export function buildCt600Draft(args: {
  team: TeamContext;
  profile: FilingProfileRecord;
  pack: YearEndPackRecord;
  closeCompanyLoansSchedule?: CloseCompanyLoansScheduleRecord | null;
  corporationTaxRateSchedule?: CorporationTaxRateScheduleRecord | null;
  generatedAt?: string;
}): Ct600Draft {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const profitAndLoss = parsePackArray<SummaryLine>(args.pack.profitAndLoss);
  const balanceSheet = parsePackArray<SummaryLine>(args.pack.balanceSheet);
  const workingPapers = parsePackArray<WorkingPaperSection>(
    args.pack.workingPapers,
  );
  const retainedEarnings = (args.pack
    .retainedEarnings as RetainedEarningsRollforward | null) ?? {
    openingBalance: 0,
    currentPeriodProfit: 0,
    manualEquityAdjustments: 0,
    closingBalance: 0,
  };
  const corporationTax =
    (args.pack.corporationTax as CorporationTaxSummary | null) ?? null;
  const turnover = Math.max(getSummaryAmount(profitAndLoss, "revenue"), 0);
  const accountingProfitBeforeTax =
    corporationTax?.accountingProfitBeforeTax ??
    getSummaryAmount(profitAndLoss, "profit_before_tax");
  const equitySection = getWorkingPaperSection(workingPapers, "equity");
  const debtSection = getWorkingPaperSection(workingPapers, "debt");
  const shareCapital = getWorkingPaperLineAmount(equitySection, "3000");
  const balanceSheetEquity = getSummaryAmount(balanceSheet, "equity");
  const netAssets = roundCurrency(
    getSummaryAmount(balanceSheet, "assets") -
      getSummaryAmount(balanceSheet, "liabilities"),
  );
  const totalEquity = roundCurrency(
    shareCapital +
      retainedEarnings.closingBalance +
      (balanceSheetEquity - shareCapital - retainedEarnings.closingBalance),
  );
  const evaluation = evaluateYearEndFilingReadiness({
    profile: args.profile,
    pack: args.pack,
    closeCompanyLoansSchedule: args.closeCompanyLoansSchedule,
    corporationTaxRateSchedule: args.corporationTaxRateSchedule,
    shareCapitalFromLedger: shareCapital,
    balanceSheetEquity,
    totalEquity,
    netAssets,
    debtBalance: debtSection?.total ?? 0,
    accountingProfitBeforeTax,
    corporationTax,
  });
  const chargeableProfits = roundCurrency(
    Math.max(
      evaluation.computationBreakdown.totalProfitsChargeableToCorporationTax,
      0,
    ),
  );
  const rateSummary = buildCorporationTaxRateSummary({
    periodStart: args.pack.periodStart,
    periodEnd: args.pack.periodEnd,
    chargeableProfits,
    rateSchedule: args.corporationTaxRateSchedule,
  });
  const taxRate = roundCurrency(rateSummary.effectiveTaxRate * 100) / 100;
  const grossCorporationTax = rateSummary.grossCorporationTaxDue;
  const marginalRelief = rateSummary.marginalRelief;
  const netCorporationTaxChargeable = rateSummary.netCorporationTaxDue;
  const ct600aSupplement = buildCt600aSupplement(
    args.closeCompanyLoansSchedule,
  );
  const loansToParticipatorsTax = ct600aSupplement?.taxPayable ?? 0;
  const totalTaxPayable = roundCurrency(
    netCorporationTaxChargeable + loansToParticipatorsTax,
  );
  const reviewItems = [
    "The draft XML includes an HMRC-style GovTalk envelope, a computed IRmark, and structured iXBRL attachments for the supported small-company path.",
    ct600aSupplement
      ? "CT600A is included from the close-company loans schedule saved against this year-end period."
      : "No CT600 supplementary page is included for this period unless a close-company loans schedule is saved.",
    ...evaluation.filingReadiness.warnings,
  ];

  if (!args.profile.utr) {
    reviewItems.push(
      "Add the company UTR in the filing profile before using this CT600 draft externally.",
    );
  }

  if (!evaluation.filingReadiness.isReady) {
    reviewItems.push(...evaluation.filingReadiness.blockers);
  }

  return {
    generatedAt,
    companyName:
      args.profile.companyName ?? args.team.name ?? "Unnamed company",
    companyNumber: args.profile.companyNumber,
    utr: args.profile.utr,
    periodStart: args.pack.periodStart,
    periodEnd: args.pack.periodEnd,
    accountsDueDate: args.pack.accountsDueDate,
    currency: args.pack.currency,
    companyType: 0,
    turnover,
    tradingProfits: evaluation.computationBreakdown.netTradingProfits,
    lossesBroughtForward: evaluation.computationBreakdown.lossesBroughtForward,
    netProfits: roundCurrency(
      evaluation.computationBreakdown.netTradingProfits -
        evaluation.computationBreakdown.lossesBroughtForward,
    ),
    profitsBeforeOtherDeductions: roundCurrency(
      evaluation.computationBreakdown.netTradingProfits -
        evaluation.computationBreakdown.lossesBroughtForward,
    ),
    profitsBeforeDonationsAndGroupRelief:
      evaluation.computationBreakdown.profitsBeforeChargesAndGroupRelief,
    chargeableProfits,
    corporationTax: grossCorporationTax,
    netCorporationTaxChargeable,
    netCorporationTaxLiability: totalTaxPayable,
    taxChargeable: totalTaxPayable,
    taxPayable: totalTaxPayable,
    loansToParticipatorsTax,
    ct600AReliefDue: (ct600aSupplement?.loanLaterReliefNow?.reliefDue ?? 0) > 0,
    taxRate,
    financialYear:
      rateSummary.financialYears[0]?.financialYear ??
      getCorporationTaxFinancialYear(args.pack.periodStart),
    grossCorporationTax,
    marginalRelief,
    exemptDistributions: rateSummary.exemptDistributions,
    augmentedProfits: rateSummary.augmentedProfits,
    startingOrSmallCompaniesRate: rateSummary.startingOrSmallCompaniesRate,
    associatedCompaniesMode: rateSummary.associatedCompaniesMode,
    associatedCompaniesThisPeriod: rateSummary.associatedCompaniesThisPeriod,
    associatedCompaniesFirstYear: rateSummary.associatedCompaniesFirstYear,
    associatedCompaniesSecondYear: rateSummary.associatedCompaniesSecondYear,
    financialYearBreakdown: rateSummary.financialYears,
    declarationName: args.profile.companyName ?? args.team.name ?? "Director",
    declarationStatus: "Director",
    returnType: "new",
    computationBreakdown: evaluation.computationBreakdown,
    supplementaryPages: {
      ct600a: ct600aSupplement,
    },
    reviewItems,
    limitations: evaluation.filingReadiness.isReady
      ? [
          `This draft is filing-ready for the supported path: ${SUPPORTED_SMALL_COMPANY_FILING_PATH}.`,
          "CT600A and HMRC marginal relief are supported. Other supplementary CT schedules and regimes outside the supported small-company path remain out of scope.",
        ]
      : [
          "This XML is submission-shaped to HMRC's published CT600 samples but should not be submitted until every filing-readiness blocker is cleared.",
          "CT600A and HMRC marginal relief are supported. Other supplementary CT schedules and regimes outside the supported small-company path remain out of scope.",
        ],
    filingReadiness: evaluation.filingReadiness,
  };
}

function buildCtSubmissionArtifacts(args: {
  team: TeamContext;
  profile: FilingProfileRecord;
  pack: YearEndPackRecord;
  closeCompanyLoansSchedule?: CloseCompanyLoansScheduleRecord | null;
  corporationTaxRateSchedule?: CorporationTaxRateScheduleRecord | null;
}): CtSubmissionArtifacts {
  const statutoryAccountsDraft = buildStatutoryAccountsDraft({
    team: args.team,
    profile: args.profile,
    pack: args.pack,
    closeCompanyLoansSchedule: args.closeCompanyLoansSchedule,
    corporationTaxRateSchedule: args.corporationTaxRateSchedule,
  });
  const ct600Draft = buildCt600Draft({
    team: args.team,
    profile: args.profile,
    pack: args.pack,
    closeCompanyLoansSchedule: args.closeCompanyLoansSchedule,
    corporationTaxRateSchedule: args.corporationTaxRateSchedule,
  });
  const statutoryAccountsDraftHtml = renderStatutoryAccountsDraftHtml(
    statutoryAccountsDraft,
  );
  const statutoryAccountsDraftJson = JSON.stringify(
    statutoryAccountsDraft,
    null,
    2,
  );
  const accountsAttachmentIxbrl = renderAccountsAttachmentIxbrl(
    statutoryAccountsDraft,
  );
  const computationsAttachmentIxbrl =
    renderComputationsAttachmentIxbrl(ct600Draft);
  const ct600DraftXml = renderCt600DraftXml(ct600Draft, {
    accountsAttachmentXhtml: accountsAttachmentIxbrl,
    computationsAttachmentXhtml: computationsAttachmentIxbrl,
  });
  const ct600DraftJson = JSON.stringify(ct600Draft, null, 2);

  return {
    statutoryAccountsDraft,
    statutoryAccountsDraftHtml,
    statutoryAccountsDraftJson,
    ct600Draft,
    ct600DraftXml,
    ct600DraftJson,
    accountsAttachmentIxbrl,
    computationsAttachmentIxbrl,
  };
}

function getSubmissionEventRequestPeriodKey(
  event: {
    requestPayload?: Record<string, unknown>;
  } | null,
) {
  const periodKey = event?.requestPayload?.periodKey;
  return typeof periodKey === "string" ? periodKey : null;
}

function getSubmissionEventResponseEndpoint(
  event: {
    responsePayload?: Record<string, unknown>;
  } | null,
) {
  const responseEndpoint = event?.responsePayload?.responseEndpoint;
  return typeof responseEndpoint === "string" ? responseEndpoint : null;
}

function getSubmissionEventRequestSubmissionNumber(
  event: {
    requestPayload?: Record<string, unknown>;
  } | null,
) {
  const submissionNumber = event?.requestPayload?.submissionNumber;
  return typeof submissionNumber === "string" ? submissionNumber : null;
}

function buildCompaniesHouseSubmissionIdentifiers(periodKey: string) {
  const seed = `${periodKey}:${Date.now()}:${Math.random()}`;
  const hash = createHash("sha1").update(seed).digest("hex").toUpperCase();

  return {
    submissionNumber: `AA${hash.slice(0, 4)}`,
    transactionId: `OPS${hash.slice(4, 16)}`,
  };
}

function findCompaniesHouseSubmissionStatus(
  message: CompaniesHouseGatewayMessage,
  submissionNumber?: string | null,
) {
  if (!submissionNumber) {
    return message.statuses[0] ?? null;
  }

  return (
    message.statuses.find(
      (status) => status.submissionNumber === submissionNumber,
    ) ??
    message.statuses[0] ??
    null
  );
}

function resolveCompaniesHouseAccountsSubmissionStatus(
  message: CompaniesHouseGatewayMessage,
  submissionNumber?: string | null,
) {
  const status = findCompaniesHouseSubmissionStatus(message, submissionNumber);

  switch (status?.statusCode) {
    case "ACCEPT":
      return "accepted";
    case "REJECT":
    case "INTERNAL_FAILURE":
      return "rejected";
    case "PENDING":
    case "PARKED":
      return "submitted";
    default:
      return message.qualifier === "error" ? "rejected" : "submitted";
  }
}

function resolveCtSubmissionStatus(message: {
  status?: "submitted" | "accepted" | "rejected";
  qualifier: string | null;
}) {
  if (message.status) {
    return message.status;
  }

  switch (message.qualifier) {
    case "response":
      return "accepted";
    case "error":
      return "rejected";
    default:
      return "submitted";
  }
}

async function createCtSubmissionArtifactBundle(args: {
  teamId: string;
  periodKey: string;
  environment: HmrcCtEnvironment;
  submissionReference: string;
  requestSummary: Record<string, unknown>;
  ct600Xml: string;
  accountsAttachmentIxbrl: string;
  computationsAttachmentIxbrl: string;
}) {
  return createSubmissionArtifactBundle({
    teamId: args.teamId,
    scope: "corporation-tax",
    periodKey: args.periodKey,
    files: [
      {
        name: "ct600-submission.xml",
        data: Buffer.from(args.ct600Xml, "utf8"),
      },
      {
        name: "accounts-attachment.ixbrl.xhtml",
        data: Buffer.from(args.accountsAttachmentIxbrl, "utf8"),
      },
      {
        name: "computations-attachment.ixbrl.xhtml",
        data: Buffer.from(args.computationsAttachmentIxbrl, "utf8"),
      },
      {
        name: "submission-request.json",
        data: Buffer.from(JSON.stringify(args.requestSummary, null, 2), "utf8"),
      },
    ],
    manifest: {
      scope: "corporation-tax",
      periodKey: args.periodKey,
      environment: args.environment,
      submissionReference: args.submissionReference,
      files: [
        "ct600-submission.xml",
        "accounts-attachment.ixbrl.xhtml",
        "computations-attachment.ixbrl.xhtml",
        "submission-request.json",
      ],
    },
  });
}

function buildCtSubmissionRequestSummary(args: {
  periodKey: string;
  profile: FilingProfileRecord;
  draft: Ct600Draft;
  provider: HmrcCtProvider;
  artifactBundle?: SubmissionArtifactBundleRecord | null;
}) {
  const providerConfig = args.provider.toConfig();
  return {
    periodKey: args.periodKey,
    environment: providerConfig.environment,
    submissionReference: resolveHmrcCtSubmissionReference(args.draft.utr),
    companyName: args.profile.companyName,
    companyNumber: args.profile.companyNumber,
    companyUtr: args.profile.utr,
    senderId: providerConfig.senderId,
    vendorId: providerConfig.vendorId,
    productName: providerConfig.productName,
    productVersion: providerConfig.productVersion,
    chargeableProfits: args.draft.chargeableProfits,
    taxPayable: args.draft.taxPayable,
    attachments: ["accounts", "computations"],
    supplementaryPages: args.draft.supplementaryPages.ct600a ? ["CT600A"] : [],
    artifactFiles: [
      "ct600-submission.xml",
      "accounts-attachment.ixbrl.xhtml",
      "computations-attachment.ixbrl.xhtml",
      "submission-request.json",
    ],
    artifactBundle: args.artifactBundle ?? null,
  };
}

function resolveHmrcCtSubmissionReference(companyUtr?: string | null) {
  return (
    getHmrcCtRuntimeStatus({
      utr: companyUtr ?? null,
    }).submissionReference ?? "MISSING-UTR"
  );
}

function assertHmrcCtSubmissionReferenceReady(
  provider: HmrcCtProvider,
  profile: FilingProfileRecord,
) {
  const runtimeStatus = getHmrcCtRuntimeStatus(profile);

  if (runtimeStatus.submissionReference) {
    return runtimeStatus;
  }

  if (provider.environment === "production") {
    throw new Error(
      "Add the company UTR in compliance settings before switching HMRC CT filing to production.",
    );
  }

  throw new Error(
    "Set HMRC_CT_TEST_UTR on the API runtime or add the company UTR in compliance settings before CT submission.",
  );
}

function buildCompaniesHouseAccountsSubmissionRequestSummary(args: {
  periodKey: string;
  profile: FilingProfileRecord;
  draft: StatutoryAccountsDraft;
  provider: CompaniesHouseXmlGatewayProvider;
  submissionNumber: string;
  transactionId: string;
}) {
  return {
    periodKey: args.periodKey,
    environment: args.provider.environment,
    companyName: args.profile.companyName,
    companyNumber: args.profile.companyNumber,
    companyAuthenticationCodeConfigured: Boolean(
      args.profile.companyAuthenticationCode,
    ),
    presenterId: args.provider.presenterId,
    packageReference: args.provider.packageReference,
    submissionNumber: args.submissionNumber,
    transactionId: args.transactionId,
    customerReference: `YE${args.periodKey.replaceAll("-", "")}`,
    accountsDueDate: args.draft.accountsDueDate,
    approvalDate: args.draft.approvalDate,
    filingReadiness: args.draft.filingReadiness,
  };
}

function requireReadyYearEndPack(pack: YearEndPackRecord | null) {
  if (!pack) {
    throw new Error("Build the current year-end pack before submission");
  }

  if (pack.status === "draft") {
    throw new Error(
      "The current year-end pack is still draft. Rebuild and resolve any imbalance before CT submission.",
    );
  }

  return pack;
}

export async function listCtSubmissionEvents(
  db: Database,
  params: { teamId: string; periodKey?: string },
) {
  void db;

  const events = await listSubmissionEventsFromConvex({
    teamId: params.teamId,
    provider: "hmrc-ct",
    obligationType: "corporation_tax",
  });

  return params.periodKey
    ? events.filter(
        (event) =>
          getSubmissionEventRequestPeriodKey(event) === params.periodKey,
      )
    : events;
}

export async function listAccountsSubmissionEvents(
  db: Database,
  params: { teamId: string; periodKey?: string },
) {
  void db;

  const events = await listSubmissionEventsFromConvex({
    teamId: params.teamId,
    provider: "companies-house",
    obligationType: "accounts",
  });

  return params.periodKey
    ? events.filter(
        (event) =>
          getSubmissionEventRequestPeriodKey(event) === params.periodKey,
      )
    : events;
}

export async function submitCt600ToHmrc(
  db: Database,
  params: {
    teamId: string;
    submittedBy: string;
    periodKey?: string;
    declarationAccepted: true;
  },
) {
  const context = await getYearEndContext(db, params.teamId, params.periodKey);
  const [packRecord, closeCompanyLoansSchedule, corporationTaxRateSchedule] =
    await Promise.all([
      getYearEndPackByPeriodFromConvex({
        teamId: params.teamId,
        filingProfileId: context.profile.id,
        periodKey: context.period.periodKey,
      }),
      getCloseCompanyLoansScheduleByPeriodFromConvex({
        teamId: params.teamId,
        filingProfileId: context.profile.id,
        periodKey: context.period.periodKey,
      }),
      getCorporationTaxRateScheduleByPeriodFromConvex({
        teamId: params.teamId,
        filingProfileId: context.profile.id,
        periodKey: context.period.periodKey,
      }),
    ]);
  const pack = requireReadyYearEndPack(packRecord);
  const artifacts = buildCtSubmissionArtifacts({
    team: context.team,
    profile: context.profile,
    pack,
    closeCompanyLoansSchedule,
    corporationTaxRateSchedule,
  });

  if (!params.declarationAccepted) {
    throw new Error("Declaration must be accepted before CT submission");
  }

  if (!artifacts.ct600Draft.filingReadiness.isReady) {
    throw new Error(
      [
        "CT600 submission is blocked until the supported filing-ready path is complete.",
        ...artifacts.ct600Draft.filingReadiness.blockers,
      ].join(" "),
    );
  }

  let provider: HmrcCtProvider;

  try {
    provider = HmrcCtProvider.fromEnvironment();
  } catch (error) {
    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "hmrc-ct",
      obligationType: "corporation_tax",
      status: "failed",
      eventType: "return_submission_failed",
      requestPayload: {
        periodKey: context.period.periodKey,
      },
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  assertHmrcCtSubmissionReferenceReady(provider, context.profile);

  const requestSummaryBase = buildCtSubmissionRequestSummary({
    periodKey: context.period.periodKey,
    profile: context.profile,
    draft: artifacts.ct600Draft,
    provider,
  });
  let artifactBundle: SubmissionArtifactBundleRecord;

  try {
    artifactBundle = await createCtSubmissionArtifactBundle({
      teamId: params.teamId,
      periodKey: context.period.periodKey,
      environment: provider.environment,
      submissionReference: String(requestSummaryBase.submissionReference),
      requestSummary: requestSummaryBase,
      ct600Xml: artifacts.ct600DraftXml,
      accountsAttachmentIxbrl: artifacts.accountsAttachmentIxbrl,
      computationsAttachmentIxbrl: artifacts.computationsAttachmentIxbrl,
    });
  } catch (error) {
    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "hmrc-ct",
      obligationType: "corporation_tax",
      status: "failed",
      eventType: "return_submission_failed",
      requestPayload: requestSummaryBase,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const requestSummary = buildCtSubmissionRequestSummary({
    periodKey: context.period.periodKey,
    profile: context.profile,
    draft: artifacts.ct600Draft,
    provider,
    artifactBundle,
  });

  try {
    const receipt = await provider.submitSubmissionXml(artifacts.ct600DraftXml);

    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "hmrc-ct",
      obligationType: "corporation_tax",
      status: resolveCtSubmissionStatus(receipt),
      eventType: "return_submitted",
      correlationId: receipt.correlationId,
      requestPayload: requestSummary,
      responsePayload: receipt as unknown as Record<string, unknown>,
    });

    return {
      receipt,
      request: requestSummary,
    };
  } catch (error) {
    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "hmrc-ct",
      obligationType: "corporation_tax",
      status: "failed",
      eventType: "return_submission_failed",
      requestPayload: requestSummary,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function pollCt600Submission(
  db: Database,
  params: {
    teamId: string;
    periodKey?: string;
    correlationId?: string;
    responseEndpoint?: string | null;
  },
) {
  const context = await getYearEndContext(db, params.teamId, params.periodKey);
  const events = await listCtSubmissionEvents(db, {
    teamId: params.teamId,
    periodKey: context.period.periodKey,
  });
  const targetEvent = params.correlationId
    ? (events.find((event) => event.correlationId === params.correlationId) ??
      null)
    : (events.find((event) => Boolean(event.correlationId)) ?? null);

  if (!targetEvent?.correlationId) {
    throw new Error("No CT submission acknowledgement is available to poll");
  }

  const provider = HmrcCtProvider.fromEnvironment();
  const requestPayload = {
    periodKey: context.period.periodKey,
    correlationId: targetEvent.correlationId,
    responseEndpoint:
      params.responseEndpoint ??
      getSubmissionEventResponseEndpoint(targetEvent) ??
      null,
    environment: provider.environment,
  };

  try {
    const receipt = await provider.pollSubmission({
      correlationId: targetEvent.correlationId,
      responseEndpoint:
        params.responseEndpoint ??
        getSubmissionEventResponseEndpoint(targetEvent) ??
        undefined,
    });

    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "hmrc-ct",
      obligationType: "corporation_tax",
      status: resolveCtSubmissionStatus(receipt),
      eventType: "submission_polled",
      correlationId: receipt.correlationId ?? targetEvent.correlationId,
      requestPayload,
      responsePayload: receipt as unknown as Record<string, unknown>,
    });

    return {
      receipt,
      previousSubmission: targetEvent,
    };
  } catch (error) {
    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "hmrc-ct",
      obligationType: "corporation_tax",
      status: "failed",
      eventType: "submission_poll_failed",
      correlationId: targetEvent.correlationId,
      requestPayload,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function submitAnnualAccountsToCompaniesHouse(
  db: Database,
  params: {
    teamId: string;
    submittedBy: string;
    periodKey?: string;
    declarationAccepted: true;
  },
) {
  const context = await getYearEndContext(db, params.teamId, params.periodKey);
  const [packRecord, closeCompanyLoansSchedule, corporationTaxRateSchedule] =
    await Promise.all([
      getYearEndPackByPeriodFromConvex({
        teamId: params.teamId,
        filingProfileId: context.profile.id,
        periodKey: context.period.periodKey,
      }),
      getCloseCompanyLoansScheduleByPeriodFromConvex({
        teamId: params.teamId,
        filingProfileId: context.profile.id,
        periodKey: context.period.periodKey,
      }),
      getCorporationTaxRateScheduleByPeriodFromConvex({
        teamId: params.teamId,
        filingProfileId: context.profile.id,
        periodKey: context.period.periodKey,
      }),
    ]);
  const pack = requireReadyYearEndPack(packRecord);
  const submissionArtifacts = buildCtSubmissionArtifacts({
    team: context.team,
    profile: context.profile,
    pack,
    closeCompanyLoansSchedule,
    corporationTaxRateSchedule,
  });
  const companyAuthenticationCode =
    context.profile.companyAuthenticationCode?.trim().toUpperCase() ?? null;

  if (!params.declarationAccepted) {
    throw new Error(
      "Declaration must be accepted before Companies House accounts submission",
    );
  }

  if (!submissionArtifacts.statutoryAccountsDraft.filingReadiness.isReady) {
    throw new Error(
      [
        "Annual accounts submission is blocked until the supported filing-ready path is complete.",
        ...submissionArtifacts.statutoryAccountsDraft.filingReadiness.blockers,
      ].join(" "),
    );
  }

  if (!companyAuthenticationCode) {
    throw new Error(
      "Add the Companies House authentication code in compliance settings before annual accounts submission",
    );
  }

  let provider: CompaniesHouseXmlGatewayProvider;

  try {
    provider = CompaniesHouseXmlGatewayProvider.fromEnvironment();
  } catch (error) {
    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "companies-house",
      obligationType: "accounts",
      status: "failed",
      eventType: "annual_accounts_submission_failed",
      requestPayload: {
        periodKey: context.period.periodKey,
      },
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const identifiers = buildCompaniesHouseSubmissionIdentifiers(
    context.period.periodKey,
  );
  const requestSummary = {
    ...buildCompaniesHouseAccountsSubmissionRequestSummary({
      periodKey: context.period.periodKey,
      profile: context.profile,
      draft: submissionArtifacts.statutoryAccountsDraft,
      provider,
      submissionNumber: identifiers.submissionNumber,
      transactionId: identifiers.transactionId,
    }),
    submittedBy: params.submittedBy,
  };
  const submissionXml = provider.buildAccountsSubmissionXml({
    companyName: submissionArtifacts.statutoryAccountsDraft.companyName,
    companyNumber:
      context.profile.companyNumber ??
      submissionArtifacts.statutoryAccountsDraft.companyNumber ??
      "",
    companyAuthenticationCode,
    dateSigned:
      submissionArtifacts.statutoryAccountsDraft.approvalDate ??
      context.period.periodEnd,
    accountsIxbrl: submissionArtifacts.accountsAttachmentIxbrl,
    submissionNumber: identifiers.submissionNumber,
    transactionId: identifiers.transactionId,
    customerReference: requestSummary.customerReference,
  });

  try {
    const receipt = await provider.submitAccountsXml(submissionXml);
    const selectedStatus = findCompaniesHouseSubmissionStatus(
      receipt,
      identifiers.submissionNumber,
    );

    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "companies-house",
      obligationType: "accounts",
      status: resolveCompaniesHouseAccountsSubmissionStatus(
        receipt,
        identifiers.submissionNumber,
      ),
      eventType: "annual_accounts_submitted",
      correlationId: identifiers.submissionNumber,
      requestPayload: requestSummary,
      responsePayload: {
        ...receipt,
        selectedStatus,
      } as unknown as Record<string, unknown>,
    });

    return {
      receipt,
      request: requestSummary,
      submissionXml,
    };
  } catch (error) {
    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "companies-house",
      obligationType: "accounts",
      status: "failed",
      eventType: "annual_accounts_submission_failed",
      correlationId: identifiers.submissionNumber,
      requestPayload: requestSummary,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function pollAnnualAccountsSubmission(
  db: Database,
  params: {
    teamId: string;
    periodKey?: string;
    submissionNumber?: string;
  },
) {
  const context = await getYearEndContext(db, params.teamId, params.periodKey);
  const events = await listAccountsSubmissionEvents(db, {
    teamId: params.teamId,
    periodKey: context.period.periodKey,
  });
  const targetEvent = params.submissionNumber
    ? (events.find(
        (event) =>
          getSubmissionEventRequestSubmissionNumber(event) ===
          params.submissionNumber,
      ) ?? null)
    : (events.find((event) =>
        Boolean(getSubmissionEventRequestSubmissionNumber(event)),
      ) ?? null);
  const submissionNumber =
    params.submissionNumber ??
    getSubmissionEventRequestSubmissionNumber(targetEvent);

  if (!submissionNumber) {
    throw new Error(
      "No Companies House annual accounts submission is available to poll",
    );
  }

  const provider = CompaniesHouseXmlGatewayProvider.fromEnvironment();
  const requestPayload = {
    periodKey: context.period.periodKey,
    submissionNumber,
    companyNumber: context.profile.companyNumber,
    environment: provider.environment,
  };

  try {
    const receipt = await provider.pollSubmissionStatus({
      submissionNumber,
      companyNumber: context.profile.companyNumber ?? undefined,
    });
    const selectedStatus = findCompaniesHouseSubmissionStatus(
      receipt,
      submissionNumber,
    );

    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "companies-house",
      obligationType: "accounts",
      status: resolveCompaniesHouseAccountsSubmissionStatus(
        receipt,
        submissionNumber,
      ),
      eventType: "annual_accounts_polled",
      correlationId: submissionNumber,
      requestPayload,
      responsePayload: {
        ...receipt,
        selectedStatus,
      } as unknown as Record<string, unknown>,
    });

    return {
      receipt,
      previousSubmission: targetEvent,
    };
  } catch (error) {
    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "companies-house",
      obligationType: "accounts",
      status: "failed",
      eventType: "annual_accounts_poll_failed",
      correlationId: submissionNumber,
      requestPayload,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function createYearEndExportBundle(args: {
  teamId: string;
  team: TeamContext;
  profile: FilingProfileRecord;
  pack: YearEndPackRecord;
  closeCompanyLoansSchedule?: CloseCompanyLoansScheduleRecord | null;
  corporationTaxRateSchedule?: CorporationTaxRateScheduleRecord | null;
}) {
  const trialBalance = parsePackArray<TrialBalanceLine>(args.pack.trialBalance);
  const submissionArtifacts = buildCtSubmissionArtifacts({
    team: args.team,
    profile: args.profile,
    pack: args.pack,
    closeCompanyLoansSchedule: args.closeCompanyLoansSchedule,
    corporationTaxRateSchedule: args.corporationTaxRateSchedule,
  });
  const workingPapers = parsePackArray<WorkingPaperSection>(
    args.pack.workingPapers,
  );
  const corporationTax =
    (args.pack.corporationTax as CorporationTaxSummary | null) ?? null;
  const companiesHouseXmlProvider = (() => {
    try {
      return CompaniesHouseXmlGatewayProvider.fromEnvironment();
    } catch {
      return null;
    }
  })();
  const companiesHouseSubmissionIdentifiers =
    companiesHouseXmlProvider &&
    submissionArtifacts.statutoryAccountsDraft.approvalDate
      ? buildCompaniesHouseSubmissionIdentifiers(args.pack.periodKey)
      : null;
  const companiesHouseSubmissionCompanyNumber =
    submissionArtifacts.statutoryAccountsDraft.companyNumber;
  const companiesHouseAccountsSubmissionXml =
    companiesHouseXmlProvider &&
    companiesHouseSubmissionIdentifiers &&
    companiesHouseSubmissionCompanyNumber
      ? companiesHouseXmlProvider.buildAccountsSubmissionXml({
          companyName: submissionArtifacts.statutoryAccountsDraft.companyName,
          companyNumber: companiesHouseSubmissionCompanyNumber,
          companyAuthenticationCode: args.profile.companyAuthenticationCode,
          dateSigned:
            submissionArtifacts.statutoryAccountsDraft.approvalDate ??
            args.pack.periodEnd,
          accountsIxbrl: submissionArtifacts.accountsAttachmentIxbrl,
          submissionNumber:
            companiesHouseSubmissionIdentifiers.submissionNumber,
          transactionId: companiesHouseSubmissionIdentifiers.transactionId,
          customerReference: `YE${args.pack.periodKey.replaceAll("-", "")}`,
        })
      : null;

  const trialBalanceCsv = await writeToString(trialBalance, {
    headers: true,
  });
  const workingPapersCsv = await writeToString(
    workingPapers.flatMap((section) =>
      section.lines.map((line) => ({
        section: section.label,
        accountCode: line.accountCode,
        accountName: line.accountName,
        accountType: line.accountType,
        balance: line.balance,
      })),
    ),
    {
      headers: true,
    },
  );
  const ctSummaryCsv = await writeToString(
    [
      {
        label: "Accounting profit before tax",
        amount: corporationTax?.accountingProfitBeforeTax ?? 0,
      },
      {
        label: "Manual tax adjustments",
        amount: corporationTax?.manualAdjustmentsTotal ?? 0,
      },
      {
        label: "Taxable profit",
        amount: corporationTax?.taxableProfit ?? 0,
      },
      {
        label: "Estimated corporation tax due",
        amount: corporationTax?.estimatedCorporationTaxDue ?? 0,
      },
    ],
    {
      headers: true,
    },
  );

  const manifest = {
    packId: args.pack.id,
    periodKey: args.pack.periodKey,
    generatedAt: new Date().toISOString(),
    snapshotChecksum: args.pack.snapshotChecksum,
    files: [
      {
        name: "trial-balance.csv",
        checksum: buildCsvChecksum(trialBalanceCsv),
      },
      {
        name: "working-papers.csv",
        checksum: buildCsvChecksum(workingPapersCsv),
      },
      {
        name: "ct-summary.csv",
        checksum: buildCsvChecksum(ctSummaryCsv),
      },
      {
        name: "statutory-accounts-draft.html",
        checksum: createHash("sha256")
          .update(submissionArtifacts.statutoryAccountsDraftHtml)
          .digest("hex"),
      },
      {
        name: "statutory-accounts-draft.json",
        checksum: createHash("sha256")
          .update(submissionArtifacts.statutoryAccountsDraftJson)
          .digest("hex"),
      },
      {
        name: "ct600-draft.xml",
        checksum: createHash("sha256")
          .update(submissionArtifacts.ct600DraftXml)
          .digest("hex"),
      },
      {
        name: "ct600-draft.json",
        checksum: createHash("sha256")
          .update(submissionArtifacts.ct600DraftJson)
          .digest("hex"),
      },
      {
        name: "accounts-attachment.ixbrl.xhtml",
        checksum: createHash("sha256")
          .update(submissionArtifacts.accountsAttachmentIxbrl)
          .digest("hex"),
      },
      {
        name: "computations-attachment.ixbrl.xhtml",
        checksum: createHash("sha256")
          .update(submissionArtifacts.computationsAttachmentIxbrl)
          .digest("hex"),
      },
      ...(companiesHouseAccountsSubmissionXml
        ? [
            {
              name: "companies-house-accounts-submission.xml",
              checksum: createHash("sha256")
                .update(companiesHouseAccountsSubmissionXml)
                .digest("hex"),
            },
          ]
        : []),
      ...(args.closeCompanyLoansSchedule
        ? [
            {
              name: "ct600a-close-company-loans.json",
              checksum: createHash("sha256")
                .update(JSON.stringify(args.closeCompanyLoansSchedule, null, 2))
                .digest("hex"),
            },
          ]
        : []),
      ...(args.corporationTaxRateSchedule
        ? [
            {
              name: "corporation-tax-rate-inputs.json",
              checksum: createHash("sha256")
                .update(
                  JSON.stringify(args.corporationTaxRateSchedule, null, 2),
                )
                .digest("hex"),
            },
          ]
        : []),
    ],
  };

  const zipBuffer = await buildZipBundle([
    {
      name: "trial-balance.csv",
      data: Buffer.from(trialBalanceCsv, "utf8"),
    },
    {
      name: "working-papers.csv",
      data: Buffer.from(workingPapersCsv, "utf8"),
    },
    {
      name: "ct-summary.csv",
      data: Buffer.from(ctSummaryCsv, "utf8"),
    },
    {
      name: "statutory-accounts-draft.html",
      data: Buffer.from(submissionArtifacts.statutoryAccountsDraftHtml, "utf8"),
    },
    {
      name: "statutory-accounts-draft.json",
      data: Buffer.from(submissionArtifacts.statutoryAccountsDraftJson, "utf8"),
    },
    {
      name: "ct600-draft.xml",
      data: Buffer.from(submissionArtifacts.ct600DraftXml, "utf8"),
    },
    {
      name: "ct600-draft.json",
      data: Buffer.from(submissionArtifacts.ct600DraftJson, "utf8"),
    },
    {
      name: "accounts-attachment.ixbrl.xhtml",
      data: Buffer.from(submissionArtifacts.accountsAttachmentIxbrl, "utf8"),
    },
    {
      name: "computations-attachment.ixbrl.xhtml",
      data: Buffer.from(
        submissionArtifacts.computationsAttachmentIxbrl,
        "utf8",
      ),
    },
    ...(companiesHouseAccountsSubmissionXml
      ? [
          {
            name: "companies-house-accounts-submission.xml",
            data: Buffer.from(companiesHouseAccountsSubmissionXml, "utf8"),
          },
        ]
      : []),
    ...(args.closeCompanyLoansSchedule
      ? [
          {
            name: "ct600a-close-company-loans.json",
            data: Buffer.from(
              JSON.stringify(args.closeCompanyLoansSchedule, null, 2),
              "utf8",
            ),
          },
        ]
      : []),
    ...(args.corporationTaxRateSchedule
      ? [
          {
            name: "corporation-tax-rate-inputs.json",
            data: Buffer.from(
              JSON.stringify(args.corporationTaxRateSchedule, null, 2),
              "utf8",
            ),
          },
        ]
      : []),
    {
      name: "manifest.json",
      data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
    },
  ]);
  const generatedAt = new Date().toISOString();
  const fileName = `year-end-${args.pack.periodKey}-${generatedAt.slice(0, 10)}.zip`;
  const filePath = `${args.teamId}/compliance/year-end/${args.pack.periodKey}/${fileName}`;
  const uploadResult = await uploadVaultFile({
    path: filePath,
    blob: zipBuffer,
    contentType: "application/zip",
    size: zipBuffer.length,
  });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  return {
    id: crypto.randomUUID(),
    filePath,
    fileName,
    checksum: createHash("sha256").update(zipBuffer).digest("hex"),
    generatedAt,
    manifest,
  } satisfies ExportBundleRecord;
}

export async function generateYearEndExport(
  db: Database,
  params: { teamId: string; periodKey?: string },
) {
  const workspace = await getYearEndPack(db, params);
  const rebuiltWorkspace = workspace.pack
    ? null
    : await rebuildYearEndPack(db, params);
  const pack = workspace.pack ?? rebuiltWorkspace?.pack ?? null;
  const closeCompanyLoansSchedule =
    workspace.closeCompanyLoansSchedule ??
    rebuiltWorkspace?.closeCompanyLoansSchedule ??
    null;
  const corporationTaxRateSchedule =
    workspace.corporationTaxRateSchedule ??
    rebuiltWorkspace?.corporationTaxRateSchedule ??
    null;

  if (!pack) {
    throw new Error("Year-end pack not found");
  }

  const exportBundle = await createYearEndExportBundle({
    teamId: params.teamId,
    team: await getTeamContext(db, params.teamId),
    profile: workspace.profile,
    pack,
    closeCompanyLoansSchedule,
    corporationTaxRateSchedule,
  });
  const updatedPack = await upsertYearEndPackInConvex({
    id: pack.id,
    teamId: params.teamId,
    filingProfileId: pack.filingProfileId,
    periodKey: pack.periodKey,
    periodStart: pack.periodStart,
    periodEnd: pack.periodEnd,
    accountsDueDate: pack.accountsDueDate,
    corporationTaxDueDate: pack.corporationTaxDueDate,
    status: "exported",
    currency: pack.currency,
    trialBalance: pack.trialBalance,
    profitAndLoss: pack.profitAndLoss,
    balanceSheet: pack.balanceSheet,
    retainedEarnings: pack.retainedEarnings,
    workingPapers: pack.workingPapers,
    corporationTax: pack.corporationTax,
    manualJournalCount: pack.manualJournalCount,
    payrollRunCount: pack.payrollRunCount,
    exportBundles: [...pack.exportBundles, exportBundle],
    latestExportedAt: exportBundle.generatedAt,
    snapshotChecksum: pack.snapshotChecksum,
  });

  return {
    pack: updatedPack,
    exportBundle,
  };
}

export async function upsertYearEndManualJournal(
  db: Database,
  params: {
    teamId: string;
    createdBy: CurrentUserIdentityRecord["convexId"];
  } & ManualJournalInput,
) {
  const team = await getTeamContext(db, params.teamId);
  const profile = await getFilingProfile(db, params.teamId);

  if (!profile) {
    throw new Error("Filing profile not configured");
  }

  assertUkComplianceEnabled(team, profile);
  validateBalancedLines(params.lines);

  const period = resolveAnnualPeriod(profile, {
    referenceDate: parseISO(params.effectiveDate),
  });
  const sourceId = params.id ?? crypto.randomUUID();

  await upsertComplianceJournalEntryInConvex({
    teamId: params.teamId,
    entry: {
      journalEntryId: sourceId,
      entryDate: params.effectiveDate,
      reference: params.reference ?? null,
      description: params.description,
      sourceType: "manual_adjustment",
      sourceId,
      currency: profile.baseCurrency ?? team.baseCurrency ?? "GBP",
      meta: {
        createdBy: params.createdBy,
        kind: "year_end_manual_journal",
        periodKey: period.periodKey,
      },
      lines: params.lines.map((line) => ({
        accountCode: line.accountCode.trim(),
        description: line.description ?? null,
        debit: roundCurrency(line.debit),
        credit: roundCurrency(line.credit),
      })),
    },
  });

  return rebuildYearEndPack(db, {
    teamId: params.teamId,
    periodKey: period.periodKey,
  });
}

export async function deleteYearEndManualJournal(
  db: Database,
  params: {
    teamId: string;
    journalId: string;
    periodKey?: string;
  },
) {
  await deleteComplianceJournalEntryBySourceInConvex({
    teamId: params.teamId,
    sourceType: "manual_adjustment",
    sourceId: params.journalId,
  });

  return rebuildYearEndPack(db, {
    teamId: params.teamId,
    periodKey: params.periodKey,
  });
}

export async function upsertCorporationTaxAdjustment(
  db: Database,
  params: {
    teamId: string;
    createdBy: CurrentUserIdentityRecord["convexId"];
    periodKey?: string;
  } & CorporationTaxAdjustmentInput,
) {
  const context = await getYearEndContext(db, params.teamId, params.periodKey);

  await upsertCorporationTaxAdjustmentInConvex({
    id: params.id,
    teamId: params.teamId,
    filingProfileId: context.profile.id,
    periodKey: context.period.periodKey,
    category: params.category ?? "other",
    label: params.label,
    amount: roundCurrency(params.amount),
    note: params.note ?? null,
    createdBy: params.createdBy,
  });

  return rebuildYearEndPack(db, {
    teamId: params.teamId,
    periodKey: context.period.periodKey,
  });
}

export async function deleteCorporationTaxAdjustment(
  db: Database,
  params: {
    teamId: string;
    adjustmentId: string;
    periodKey?: string;
  },
) {
  const context = await getYearEndContext(db, params.teamId, params.periodKey);

  await deleteCorporationTaxAdjustmentInConvex({
    teamId: params.teamId,
    id: params.adjustmentId,
  });

  return rebuildYearEndPack(db, {
    teamId: params.teamId,
    periodKey: context.period.periodKey,
  });
}

export async function upsertCloseCompanyLoansSchedule(
  db: Database,
  params: {
    teamId: string;
    createdBy: CurrentUserIdentityRecord["convexId"];
    periodKey?: string;
    beforeEndPeriod: boolean;
    loansMade: Array<{
      name: string;
      amountOfLoan: number;
    }>;
    taxChargeable: number | null;
    reliefEarlierThan: Array<{
      name: string;
      amountRepaid: number | null;
      amountReleasedOrWrittenOff: number | null;
      date: string;
    }>;
    reliefEarlierDue: number | null;
    loanLaterReliefNow: Array<{
      name: string;
      amountRepaid: number | null;
      amountReleasedOrWrittenOff: number | null;
      date: string;
    }>;
    reliefLaterDue: number | null;
    totalLoansOutstanding: number | null;
  },
) {
  const context = await getYearEndContext(db, params.teamId, params.periodKey);

  await upsertCloseCompanyLoansScheduleInConvex({
    teamId: params.teamId,
    filingProfileId: context.profile.id,
    periodKey: context.period.periodKey,
    beforeEndPeriod: params.beforeEndPeriod,
    loansMade: params.loansMade.map((entry) => ({
      name: entry.name.trim(),
      amountOfLoan: Math.round(entry.amountOfLoan),
    })),
    taxChargeable:
      params.taxChargeable == null ? null : roundCurrency(params.taxChargeable),
    reliefEarlierThan: params.reliefEarlierThan.map((entry) => ({
      name: entry.name.trim(),
      amountRepaid:
        entry.amountRepaid == null ? null : Math.round(entry.amountRepaid),
      amountReleasedOrWrittenOff:
        entry.amountReleasedOrWrittenOff == null
          ? null
          : Math.round(entry.amountReleasedOrWrittenOff),
      date: entry.date,
    })),
    reliefEarlierDue:
      params.reliefEarlierDue == null
        ? null
        : roundCurrency(params.reliefEarlierDue),
    loanLaterReliefNow: params.loanLaterReliefNow.map((entry) => ({
      name: entry.name.trim(),
      amountRepaid:
        entry.amountRepaid == null ? null : Math.round(entry.amountRepaid),
      amountReleasedOrWrittenOff:
        entry.amountReleasedOrWrittenOff == null
          ? null
          : Math.round(entry.amountReleasedOrWrittenOff),
      date: entry.date,
    })),
    reliefLaterDue:
      params.reliefLaterDue == null
        ? null
        : roundCurrency(params.reliefLaterDue),
    totalLoansOutstanding:
      params.totalLoansOutstanding == null
        ? null
        : Math.round(params.totalLoansOutstanding),
    createdBy: params.createdBy,
  });

  return rebuildYearEndPack(db, {
    teamId: params.teamId,
    periodKey: context.period.periodKey,
  });
}

export async function deleteCloseCompanyLoansSchedule(
  db: Database,
  params: {
    teamId: string;
    periodKey?: string;
  },
) {
  const context = await getYearEndContext(db, params.teamId, params.periodKey);

  await deleteCloseCompanyLoansScheduleInConvex({
    teamId: params.teamId,
    filingProfileId: context.profile.id,
    periodKey: context.period.periodKey,
  });

  return rebuildYearEndPack(db, {
    teamId: params.teamId,
    periodKey: context.period.periodKey,
  });
}

export async function upsertCorporationTaxRateSchedule(
  db: Database,
  params: {
    teamId: string;
    createdBy: CurrentUserIdentityRecord["convexId"];
    periodKey?: string;
    exemptDistributions: number | null;
    associatedCompaniesThisPeriod: number | null;
    associatedCompaniesFirstYear: number | null;
    associatedCompaniesSecondYear: number | null;
  },
) {
  const context = await getYearEndContext(db, params.teamId, params.periodKey);

  await upsertCorporationTaxRateScheduleInConvex({
    teamId: params.teamId,
    filingProfileId: context.profile.id,
    periodKey: context.period.periodKey,
    exemptDistributions:
      params.exemptDistributions == null
        ? null
        : roundCurrency(params.exemptDistributions),
    associatedCompaniesThisPeriod:
      params.associatedCompaniesThisPeriod == null
        ? null
        : Math.max(0, Math.trunc(params.associatedCompaniesThisPeriod)),
    associatedCompaniesFirstYear:
      params.associatedCompaniesFirstYear == null
        ? null
        : Math.max(0, Math.trunc(params.associatedCompaniesFirstYear)),
    associatedCompaniesSecondYear:
      params.associatedCompaniesSecondYear == null
        ? null
        : Math.max(0, Math.trunc(params.associatedCompaniesSecondYear)),
    createdBy: params.createdBy,
  });

  return rebuildYearEndPack(db, {
    teamId: params.teamId,
    periodKey: context.period.periodKey,
  });
}

export async function deleteCorporationTaxRateSchedule(
  db: Database,
  params: {
    teamId: string;
    periodKey?: string;
  },
) {
  const context = await getYearEndContext(db, params.teamId, params.periodKey);

  await deleteCorporationTaxRateScheduleInConvex({
    teamId: params.teamId,
    filingProfileId: context.profile.id,
    periodKey: context.period.periodKey,
  });

  return rebuildYearEndPack(db, {
    teamId: params.teamId,
    periodKey: context.period.periodKey,
  });
}

export async function listAnnualObligations(
  db: Database,
  params: { teamId: string },
) {
  const context = await getYearEndContext(db, params.teamId);
  const obligations = await listComplianceObligationsFromConvex({
    teamId: params.teamId,
  });

  return obligations.filter(
    (obligation) =>
      obligation.filingProfileId === context.profile.id &&
      (obligation.obligationType === "accounts" ||
        obligation.obligationType === "corporation_tax"),
  );
}
