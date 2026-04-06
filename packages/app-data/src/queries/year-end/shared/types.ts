import type {
  CorporationTaxAdjustmentCategory,
  HmrcCtEnvironment,
  LedgerAccountType,
} from "@tamias/compliance";
import type { ComplianceObligationRecord } from "@tamias/app-data-convex";

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
  key: "bank" | "receivables" | "payables" | "vat" | "debt" | "equity" | "tax_accruals";
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
    chargeType: "flat_main_rate" | "main_rate" | "small_profits_rate" | "marginal_relief";
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
