import { z } from "zod";

export const LegalEntityTypeSchema = z.enum(["uk_ltd"]);
export type LegalEntityType = z.infer<typeof LegalEntityTypeSchema>;

export const AuthorityProviderIdSchema = z.enum([
  "hmrc-vat",
  "companies-house",
  "hmrc-ct",
  "paye-online",
]);
export type AuthorityProviderId = z.infer<typeof AuthorityProviderIdSchema>;

export const ObligationTypeSchema = z.enum([
  "vat",
  "accounts",
  "corporation_tax",
  "payroll",
]);
export type ObligationType = z.infer<typeof ObligationTypeSchema>;

export const ReturnStatusSchema = z.enum([
  "draft",
  "ready",
  "submitted",
  "accepted",
  "rejected",
]);
export type ReturnStatus = z.infer<typeof ReturnStatusSchema>;

export const VatSchemeSchema = z.enum(["standard_quarterly"]);
export type VatScheme = z.infer<typeof VatSchemeSchema>;

export const FilingModeSchema = z.enum(["client", "agent"]);
export type FilingMode = z.infer<typeof FilingModeSchema>;

export const AccountingBasisSchema = z.enum(["cash", "accrual"]);
export type AccountingBasis = z.infer<typeof AccountingBasisSchema>;

export const CorporationTaxAdjustmentCategorySchema = z.enum([
  "depreciation_amortisation",
  "charitable_donations",
  "capital_allowances",
  "capital_allowances_balancing_charges",
  "losses_brought_forward",
  "group_relief",
  "other",
]);
export type CorporationTaxAdjustmentCategory = z.infer<
  typeof CorporationTaxAdjustmentCategorySchema
>;

export const CloseCompanyLoanEntrySchema = z.object({
  name: z.string().trim().min(2).max(56),
  amountOfLoan: z.number().int().positive(),
});
export type CloseCompanyLoanEntry = z.infer<
  typeof CloseCompanyLoanEntrySchema
>;

export const CloseCompanyLoanReliefEntrySchema = z
  .object({
    name: z.string().trim().min(2).max(56),
    amountRepaid: z.number().int().positive().nullable(),
    amountReleasedOrWrittenOff: z.number().int().positive().nullable(),
    date: z.string().date(),
  })
  .superRefine((value, ctx) => {
    if (
      value.amountRepaid == null &&
      value.amountReleasedOrWrittenOff == null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Enter either an amount repaid or an amount released/written off.",
        path: ["amountRepaid"],
      });
    }
  });
export type CloseCompanyLoanReliefEntry = z.infer<
  typeof CloseCompanyLoanReliefEntrySchema
>;

export const CloseCompanyLoansScheduleSchema = z.object({
  beforeEndPeriod: z.boolean(),
  loansMade: z.array(CloseCompanyLoanEntrySchema).max(999),
  taxChargeable: z.number().positive().nullable(),
  reliefEarlierThan: z.array(CloseCompanyLoanReliefEntrySchema).max(999),
  reliefEarlierDue: z.number().positive().nullable(),
  loanLaterReliefNow: z.array(CloseCompanyLoanReliefEntrySchema).max(999),
  reliefLaterDue: z.number().positive().nullable(),
  totalLoansOutstanding: z.number().int().positive().nullable(),
});
export type CloseCompanyLoansSchedule = z.infer<
  typeof CloseCompanyLoansScheduleSchema
>;

export const CorporationTaxRateScheduleSchema = z
  .object({
    exemptDistributions: z.number().min(0).nullable(),
    associatedCompaniesThisPeriod: z.number().int().min(0).nullable(),
    associatedCompaniesFirstYear: z.number().int().min(0).nullable(),
    associatedCompaniesSecondYear: z.number().int().min(0).nullable(),
  })
  .superRefine((value, ctx) => {
    const hasThisPeriod = value.associatedCompaniesThisPeriod != null;
    const hasFirstYear = value.associatedCompaniesFirstYear != null;
    const hasSecondYear = value.associatedCompaniesSecondYear != null;

    if (hasThisPeriod && (hasFirstYear || hasSecondYear)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Enter either a single associated-companies count or split financial-year counts, not both.",
        path: ["associatedCompaniesThisPeriod"],
      });
    }

    if (!hasThisPeriod && !hasFirstYear && !hasSecondYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Enter the number of associated companies for the period, even if the answer is 0.",
        path: ["associatedCompaniesThisPeriod"],
      });
    }

    if (!hasThisPeriod && hasFirstYear !== hasSecondYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "When using split financial-year counts, enter both the first-year and second-year values.",
        path: hasFirstYear
          ? ["associatedCompaniesSecondYear"]
          : ["associatedCompaniesFirstYear"],
      });
    }
  });
export type CorporationTaxRateSchedule = z.infer<
  typeof CorporationTaxRateScheduleSchema
>;

export const ComplianceSourceTypeSchema = z.enum([
  "transaction",
  "invoice",
  "invoice_refund",
  "inbox",
  "manual_adjustment",
  "payroll_import",
]);
export type ComplianceSourceType = z.infer<typeof ComplianceSourceTypeSchema>;

export const LedgerAccountTypeSchema = z.enum([
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
]);
export type LedgerAccountType = z.infer<typeof LedgerAccountTypeSchema>;

export const FilingProfileSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  legalEntityType: LegalEntityTypeSchema,
  provider: AuthorityProviderIdSchema,
  enabled: z.boolean(),
  countryCode: z.literal("GB"),
  companyName: z.string().nullable(),
  companyNumber: z.string().nullable(),
  companyAuthenticationCode: z.string().nullable(),
  utr: z.string().nullable(),
  vrn: z.string().nullable(),
  vatScheme: VatSchemeSchema.nullable(),
  accountingBasis: AccountingBasisSchema,
  filingMode: FilingModeSchema,
  agentReferenceNumber: z.string().nullable(),
  yearEndMonth: z.number().int().min(1).max(12).nullable(),
  yearEndDay: z.number().int().min(1).max(31).nullable(),
  baseCurrency: z.string().nullable(),
  principalActivity: z.string().nullable(),
  directors: z.array(z.string()),
  signingDirectorName: z.string().nullable(),
  approvalDate: z.string().nullable(),
  averageEmployeeCount: z.number().int().min(0).nullable(),
  ordinaryShareCount: z.number().int().min(0).nullable(),
  ordinaryShareNominalValue: z.number().min(0).nullable(),
  dormant: z.boolean().nullable(),
  auditExemptionClaimed: z.boolean().nullable(),
  membersDidNotRequireAudit: z.boolean().nullable(),
  directorsAcknowledgeResponsibilities: z.boolean().nullable(),
  accountsPreparedUnderSmallCompaniesRegime: z.boolean().nullable(),
});
export type FilingProfile = z.infer<typeof FilingProfileSchema>;

export const ObligationSchema = z.object({
  id: z.string().uuid(),
  filingProfileId: z.string().uuid(),
  obligationType: ObligationTypeSchema,
  provider: AuthorityProviderIdSchema,
  periodKey: z.string(),
  start: z.string(),
  end: z.string(),
  due: z.string(),
  status: z.string(),
  externalId: z.string().nullable(),
});
export type Obligation = z.infer<typeof ObligationSchema>;

export const VatReturnDraftLineSchema = z.object({
  code: z.enum([
    "box1",
    "box2",
    "box3",
    "box4",
    "box5",
    "box6",
    "box7",
    "box8",
    "box9",
  ]),
  amount: z.number(),
  label: z.string(),
});
export type VatReturnDraftLine = z.infer<typeof VatReturnDraftLineSchema>;

export const VatReturnDraftSchema = z.object({
  id: z.string().uuid(),
  filingProfileId: z.string().uuid(),
  obligationId: z.string().uuid().nullable(),
  periodKey: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  status: ReturnStatusSchema,
  currency: z.string(),
  lines: z.array(VatReturnDraftLineSchema),
  netVatDue: z.number(),
  salesCount: z.number().int(),
  purchaseCount: z.number().int(),
  adjustmentCount: z.number().int(),
  updatedAt: z.string(),
});
export type VatReturnDraft = z.infer<typeof VatReturnDraftSchema>;

export const SubmissionReceiptSchema = z.object({
  processingDate: z.string().nullable().optional(),
  formBundleNumber: z.string().nullable().optional(),
  paymentIndicator: z.string().nullable().optional(),
  chargeRefNumber: z.string().nullable().optional(),
});
export type SubmissionReceipt = z.infer<typeof SubmissionReceiptSchema>;

export const EvidencePackSummarySchema = z.object({
  id: z.string().uuid(),
  vatReturnId: z.string().uuid(),
  checksum: z.string(),
  createdAt: z.string(),
});
export type EvidencePackSummary = z.infer<typeof EvidencePackSummarySchema>;

export const YearEndPackStatusSchema = z.enum(["draft", "ready", "exported"]);
export type YearEndPackStatus = z.infer<typeof YearEndPackStatusSchema>;

export const WorkingPaperSectionKeySchema = z.enum([
  "bank",
  "receivables",
  "payables",
  "vat",
  "debt",
  "equity",
  "tax_accruals",
]);
export type WorkingPaperSectionKey = z.infer<
  typeof WorkingPaperSectionKeySchema
>;

export const YearEndTrialBalanceLineSchema = z.object({
  accountCode: z.string(),
  accountName: z.string(),
  accountType: LedgerAccountTypeSchema,
  debit: z.number(),
  credit: z.number(),
  balance: z.number(),
});
export type YearEndTrialBalanceLine = z.infer<
  typeof YearEndTrialBalanceLineSchema
>;

export const YearEndSummaryLineSchema = z.object({
  key: z.string(),
  label: z.string(),
  amount: z.number(),
});
export type YearEndSummaryLine = z.infer<typeof YearEndSummaryLineSchema>;

export const WorkingPaperLineSchema = z.object({
  accountCode: z.string(),
  accountName: z.string(),
  accountType: LedgerAccountTypeSchema,
  balance: z.number(),
});
export type WorkingPaperLine = z.infer<typeof WorkingPaperLineSchema>;

export const WorkingPaperSectionSchema = z.object({
  key: WorkingPaperSectionKeySchema,
  label: z.string(),
  total: z.number(),
  lines: z.array(WorkingPaperLineSchema),
});
export type WorkingPaperSection = z.infer<typeof WorkingPaperSectionSchema>;

export const RetainedEarningsRollforwardSchema = z.object({
  openingBalance: z.number(),
  currentPeriodProfit: z.number(),
  manualEquityAdjustments: z.number(),
  closingBalance: z.number(),
});
export type RetainedEarningsRollforward = z.infer<
  typeof RetainedEarningsRollforwardSchema
>;

export const CorporationTaxAdjustmentSchema = z.object({
  id: z.string().uuid(),
  category: CorporationTaxAdjustmentCategorySchema,
  label: z.string(),
  amount: z.number(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type CorporationTaxAdjustment = z.infer<
  typeof CorporationTaxAdjustmentSchema
>;

export const CorporationTaxSummarySchema = z.object({
  accountingProfitBeforeTax: z.number(),
  manualAdjustmentsTotal: z.number(),
  taxableProfit: z.number(),
  estimatedTaxRate: z.number(),
  estimatedCorporationTaxDue: z.number(),
  adjustments: z.array(CorporationTaxAdjustmentSchema),
});
export type CorporationTaxSummary = z.infer<typeof CorporationTaxSummarySchema>;

export const ExportBundleSchema = z.object({
  id: z.string().uuid(),
  filePath: z.string(),
  fileName: z.string(),
  checksum: z.string(),
  generatedAt: z.string(),
  manifest: z.record(z.string(), z.unknown()),
});
export type ExportBundle = z.infer<typeof ExportBundleSchema>;

export const YearEndPackSchema = z.object({
  id: z.string().uuid(),
  filingProfileId: z.string().uuid(),
  periodKey: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  accountsDueDate: z.string(),
  corporationTaxDueDate: z.string(),
  status: YearEndPackStatusSchema,
  currency: z.string(),
  trialBalance: z.array(YearEndTrialBalanceLineSchema),
  profitAndLoss: z.array(YearEndSummaryLineSchema),
  balanceSheet: z.array(YearEndSummaryLineSchema),
  retainedEarnings: RetainedEarningsRollforwardSchema,
  workingPapers: z.array(WorkingPaperSectionSchema),
  corporationTax: CorporationTaxSummarySchema,
  manualJournalCount: z.number().int(),
  payrollRunCount: z.number().int(),
  exportBundles: z.array(ExportBundleSchema),
  latestExportedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type YearEndPack = z.infer<typeof YearEndPackSchema>;

export const PayrollImportSourceSchema = z.enum(["csv", "manual"]);
export type PayrollImportSource = z.infer<typeof PayrollImportSourceSchema>;

export const PayrollRunStatusSchema = z.enum(["imported", "exported"]);
export type PayrollRunStatus = z.infer<typeof PayrollRunStatusSchema>;

export const PayrollRunLineSchema = z.object({
  accountCode: z.string(),
  description: z.string().nullable().optional(),
  debit: z.number(),
  credit: z.number(),
});
export type PayrollRunLine = z.infer<typeof PayrollRunLineSchema>;

export const PayrollLiabilityTotalsSchema = z.object({
  grossPay: z.number(),
  employerTaxes: z.number(),
  payeLiability: z.number(),
});
export type PayrollLiabilityTotals = z.infer<
  typeof PayrollLiabilityTotalsSchema
>;

export const PayrollRunSchema = z.object({
  id: z.string().uuid(),
  filingProfileId: z.string().uuid(),
  periodKey: z.string(),
  payPeriodStart: z.string(),
  payPeriodEnd: z.string(),
  runDate: z.string(),
  source: PayrollImportSourceSchema,
  status: PayrollRunStatusSchema,
  checksum: z.string(),
  currency: z.string(),
  journalEntryId: z.string().uuid(),
  lineCount: z.number().int(),
  liabilityTotals: PayrollLiabilityTotalsSchema,
  exportBundles: z.array(ExportBundleSchema),
  latestExportedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PayrollRun = z.infer<typeof PayrollRunSchema>;

export const PayrollLiabilitySummarySchema = z.object({
  currency: z.string(),
  importedRunCount: z.number().int(),
  latestRunAt: z.string().nullable(),
  payeLiability: z.number(),
});
export type PayrollLiabilitySummary = z.infer<
  typeof PayrollLiabilitySummarySchema
>;

const BaseAuthorityConfigSchema = z.object({
  provider: AuthorityProviderIdSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.string(),
  scope: z.array(z.string()).optional(),
  tokenType: z.string().optional(),
});

export const CompaniesHouseEnvironmentSchema = z.enum([
  "sandbox",
  "production",
]);
export type CompaniesHouseEnvironment = z.infer<
  typeof CompaniesHouseEnvironmentSchema
>;

export const CompaniesHouseUserProfileSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  forename: z.string().optional(),
  surname: z.string().optional(),
  language: z.string().optional(),
});
export type CompaniesHouseUserProfile = z.infer<
  typeof CompaniesHouseUserProfileSchema
>;

export const CompaniesHouseAccountsWindowSchema = z.object({
  dueOn: z.string().optional(),
  overdue: z.boolean().optional(),
  periodEndOn: z.string().optional(),
  periodStartOn: z.string().optional(),
});
export type CompaniesHouseAccountsWindow = z.infer<
  typeof CompaniesHouseAccountsWindowSchema
>;

export const CompaniesHouseLastAccountsSchema = z.object({
  madeUpTo: z.string().optional(),
  periodEndOn: z.string().optional(),
  periodStartOn: z.string().optional(),
  type: z.string().optional(),
});
export type CompaniesHouseLastAccounts = z.infer<
  typeof CompaniesHouseLastAccountsSchema
>;

export const CompaniesHouseCompanyAccountsSchema = z.object({
  accountingReferenceDate: z
    .object({
      day: z.number().int().min(1).max(31).optional(),
      month: z.number().int().min(1).max(12).optional(),
    })
    .optional(),
  lastAccounts: CompaniesHouseLastAccountsSchema.optional(),
  nextAccounts: CompaniesHouseAccountsWindowSchema.optional(),
  nextDue: z.string().optional(),
  nextMadeUpTo: z.string().optional(),
  overdue: z.boolean().optional(),
});
export type CompaniesHouseCompanyAccounts = z.infer<
  typeof CompaniesHouseCompanyAccountsSchema
>;

export const CompaniesHouseCompanyProfileSchema = z.object({
  companyName: z.string(),
  companyNumber: z.string(),
  companyStatus: z.string().optional(),
  canFile: z.boolean().optional(),
  type: z.string().optional(),
  accounts: CompaniesHouseCompanyAccountsSchema.optional(),
  links: z
    .object({
      filingHistory: z.string().optional(),
      self: z.string().optional(),
    })
    .optional(),
});
export type CompaniesHouseCompanyProfile = z.infer<
  typeof CompaniesHouseCompanyProfileSchema
>;

export const CompaniesHouseFilingHistoryItemSchema = z.object({
  transactionId: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  type: z.string().optional(),
  date: z.string().optional(),
  description: z.string().optional(),
  descriptionValues: z.record(z.string(), z.string()).optional(),
  pages: z.number().int().optional(),
  paperFiled: z.boolean().optional(),
  links: z
    .object({
      documentMetadata: z.string().optional(),
      self: z.string().optional(),
    })
    .optional(),
});
export type CompaniesHouseFilingHistoryItem = z.infer<
  typeof CompaniesHouseFilingHistoryItemSchema
>;

export const CompaniesHouseFilingHistoryPageSchema = z.object({
  items: z.array(CompaniesHouseFilingHistoryItemSchema),
  itemsPerPage: z.number().int(),
  startIndex: z.number().int(),
  totalCount: z.number().int(),
});
export type CompaniesHouseFilingHistoryPage = z.infer<
  typeof CompaniesHouseFilingHistoryPageSchema
>;

export const CompaniesHouseProviderConfigSchema = BaseAuthorityConfigSchema.extend(
  {
    provider: z.literal("companies-house"),
    environment: CompaniesHouseEnvironmentSchema.default("sandbox"),
    userId: z.string().optional(),
    userProfile: CompaniesHouseUserProfileSchema.optional(),
  },
);
export type CompaniesHouseProviderConfig = z.infer<
  typeof CompaniesHouseProviderConfigSchema
>;

export const HmrcVatProviderConfigSchema = BaseAuthorityConfigSchema.extend({
  provider: z.literal("hmrc-vat"),
  vrn: z.string().optional(),
  environment: z.enum(["sandbox", "production"]).default("sandbox"),
});
export type HmrcVatProviderConfig = z.infer<typeof HmrcVatProviderConfigSchema>;

export const HmrcCtEnvironmentSchema = z.enum(["test", "production"]);
export type HmrcCtEnvironment = z.infer<typeof HmrcCtEnvironmentSchema>;

export const HmrcCtProviderConfigSchema = z.object({
  provider: z.literal("hmrc-ct"),
  environment: HmrcCtEnvironmentSchema.default("test"),
  senderId: z.string(),
  senderPassword: z.string(),
  vendorId: z.string(),
  productName: z.string(),
  productVersion: z.string(),
});
export type HmrcCtProviderConfig = z.infer<typeof HmrcCtProviderConfigSchema>;

export type HmrcCtGatewayError = {
  raisedBy: string | null;
  number: string | null;
  type: string | null;
  text: string | null;
  location: string | null;
};

export type HmrcCtTransactionEngineMessage = {
  qualifier: string | null;
  function: string | null;
  correlationId: string | null;
  transactionId: string | null;
  responseEndpoint: string | null;
  pollInterval: number | null;
  gatewayTimestamp: string | null;
  bodyXml: string | null;
  bodyStatus: string | null;
  bodyStatusText: string | null;
  responseType: string | null;
  formBundleNumber: string | null;
  status: "submitted" | "accepted" | "rejected";
  summary: string | null;
  errors: HmrcCtGatewayError[];
  notices: string[];
  rawXml: string;
};

export const COMPANIES_HOUSE_PROFILE_SCOPE =
  "https://identity.company-information.service.gov.uk/user/profile.read" as const;
export const COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE =
  "https://api.company-information.service.gov.uk/psc-discrepancy-reports.write-full" as const;

export const HMRC_VAT_SCOPES = ["read:vat", "write:vat"] as const;

export type HmrcObligationResponse = {
  start: string;
  end: string;
  due: string;
  status: string;
  periodKey: string;
  received?: string;
};

export type HmrcVatSubmission = {
  periodKey: string;
  vatDueSales: number;
  vatDueAcquisitions: number;
  totalVatDue: number;
  vatReclaimedCurrPeriod: number;
  netVatDue: number;
  totalValueSalesExVAT: number;
  totalValuePurchasesExVAT: number;
  totalValueGoodsSuppliedExVAT: number;
  totalAcquisitionsExVAT: number;
  finalised: boolean;
};

export type HmrcVatSubmissionResponse = SubmissionReceipt & {
  code?: string;
};

export type CompaniesHouseTransactionStatus = "open" | "closed";

export type CompaniesHouseTransaction = {
  id: string;
  companyNumber?: string;
  companyName?: string;
  description?: string;
  reference?: string;
  resumeJourneyUri?: string;
  status: CompaniesHouseTransactionStatus;
  createdAt?: string;
  updatedAt?: string;
  closedAt?: string;
  filings?: Record<
    string,
    {
      companyNumber?: string;
      description?: string;
      descriptionIdentifier?: string;
      status?: "accepted" | "processing" | "rejected";
      type?: string;
      createdOn?: string;
      processedAt?: string;
      rejectReasons?: Array<{
        english?: string;
        welsh?: string;
      }>;
    }
  >;
  resources?: Record<
    string,
    {
      kind?: string;
      links?: {
        resource?: string;
        validationStatus?: string;
        costs?: string;
      };
      updatedAt?: string;
    }
  >;
  links?: {
    self?: string;
    payment?: string;
    validationStatus?: string;
  };
};
