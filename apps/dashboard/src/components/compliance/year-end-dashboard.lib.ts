import type { EditableJournalLine } from "@/components/compliance/journal-lines-editor";

export type TrialBalanceLine = {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  balance: number;
};

export type WorkingPaperSection = {
  key: string;
  label: string;
  total: number;
  lines: Array<{
    accountCode: string;
    accountName: string;
    balance: number;
  }>;
};

export type SubmissionEvent = {
  id: string;
  status: string;
  eventType: string;
  correlationId: string | null;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: string;
};

export type HmrcCtGatewayError = {
  raisedBy?: string | null;
  number?: string | null;
  type?: string | null;
  text?: string | null;
  location?: string | null;
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

export type CloseCompanyLoanEntry = {
  name: string;
  amountOfLoan: number;
};

export type CloseCompanyLoanReliefEntry = {
  name: string;
  amountRepaid: number | null;
  amountReleasedOrWrittenOff: number | null;
  date: string;
};

export type CloseCompanyLoansSchedule = {
  beforeEndPeriod: boolean;
  loansMade: CloseCompanyLoanEntry[];
  taxChargeable: number | null;
  reliefEarlierThan: CloseCompanyLoanReliefEntry[];
  reliefEarlierDue: number | null;
  loanLaterReliefNow: CloseCompanyLoanReliefEntry[];
  reliefLaterDue: number | null;
  totalLoansOutstanding: number | null;
};

export type CorporationTaxRateSchedule = {
  exemptDistributions: number | null;
  associatedCompaniesThisPeriod: number | null;
  associatedCompaniesFirstYear: number | null;
  associatedCompaniesSecondYear: number | null;
};

export type CtFinancialYearBreakdown = {
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
  chargeType: string;
};

export type LoanRowState = {
  id: string;
  name: string;
  amountOfLoan: string;
};

export type LoanReliefRowState = {
  id: string;
  name: string;
  amountRepaid: string;
  amountReleasedOrWrittenOff: string;
  date: string;
};

export type CorporationTaxAdjustmentCategory =
  | "depreciation_amortisation"
  | "charitable_donations"
  | "capital_allowances"
  | "capital_allowances_balancing_charges"
  | "losses_brought_forward"
  | "group_relief"
  | "other";

export const CT_ADJUSTMENT_CATEGORIES: Array<{
  value: CorporationTaxAdjustmentCategory;
  label: string;
  guidance: string;
}> = [
  {
    value: "depreciation_amortisation",
    label: "Depreciation and amortisation",
    guidance:
      "Use a positive amount to add back book depreciation or amortisation.",
  },
  {
    value: "capital_allowances_balancing_charges",
    label: "Balancing charges",
    guidance:
      "Use a positive amount when balancing charges increase taxable profits.",
  },
  {
    value: "capital_allowances",
    label: "Capital allowances",
    guidance:
      "Use a negative amount for capital allowances claimed against profits.",
  },
  {
    value: "charitable_donations",
    label: "Qualifying donations",
    guidance: "Use a negative amount for qualifying charitable donations.",
  },
  {
    value: "losses_brought_forward",
    label: "Losses brought forward",
    guidance:
      "Use a negative amount for losses claimed against current profits.",
  },
  {
    value: "group_relief",
    label: "Group relief",
    guidance: "Use a negative amount for group relief claimed.",
  },
  {
    value: "other",
    label: "Other (blocks filing-ready path)",
    guidance:
      "Use only when you are not targeting the supported filing-ready path.",
  },
];

export function formatDate(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function humanizeToken(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replaceAll(/[-_]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function describeHmrcCtEnvironment(value?: string | null) {
  return value === "production" ? "HMRC live" : "HMRC test";
}

export function describeHmrcCtReferenceSource(value?: string | null) {
  switch (value) {
    case "hmrc_test_utr":
      return "SDS test UTR";
    case "filing_profile_utr":
      return "Filing profile UTR";
    default:
      return "Missing";
  }
}

export function getCorporationTaxFinancialYear(value: string) {
  const date = new Date(value);
  return date.getUTCMonth() >= 3
    ? date.getUTCFullYear()
    : date.getUTCFullYear() - 1;
}

export function periodUsesSmallProfitsRules(periodEnd?: string | null) {
  if (!periodEnd) {
    return false;
  }

  return new Date(periodEnd).getTime() >= new Date("2023-04-01").getTime();
}

export function emptyLines(): EditableJournalLine[] {
  return [
    {
      accountCode: "",
      description: "",
      debit: "",
      credit: "",
    },
    {
      accountCode: "",
      description: "",
      debit: "",
      credit: "",
    },
  ];
}

export function toNumber(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toNullableNumber(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toNullableInteger(value: string) {
  const parsed = toNullableNumber(value);
  return parsed == null ? null : Math.round(parsed);
}

export function createLoanRow(entry?: CloseCompanyLoanEntry): LoanRowState {
  return {
    id: crypto.randomUUID(),
    name: entry?.name ?? "",
    amountOfLoan: entry?.amountOfLoan != null ? String(entry.amountOfLoan) : "",
  };
}

export function createLoanReliefRow(
  entry?: CloseCompanyLoanReliefEntry,
): LoanReliefRowState {
  return {
    id: crypto.randomUUID(),
    name: entry?.name ?? "",
    amountRepaid: entry?.amountRepaid != null ? String(entry.amountRepaid) : "",
    amountReleasedOrWrittenOff:
      entry?.amountReleasedOrWrittenOff != null
        ? String(entry.amountReleasedOrWrittenOff)
        : "",
    date: entry?.date ?? "",
  };
}

export function buildLoanRows(entries?: CloseCompanyLoanEntry[] | null) {
  return entries?.length
    ? entries.map((entry) => createLoanRow(entry))
    : [createLoanRow()];
}

export function buildLoanReliefRows(
  entries?: CloseCompanyLoanReliefEntry[] | null,
) {
  return entries?.length
    ? entries.map((entry) => createLoanReliefRow(entry))
    : [createLoanReliefRow()];
}

export function isBlankLoanRow(row: LoanRowState) {
  return !row.name.trim() && !row.amountOfLoan.trim();
}

export function isCompleteLoanRow(row: LoanRowState) {
  return (
    row.name.trim().length >= 2 && toNullableInteger(row.amountOfLoan) != null
  );
}

export function isBlankLoanReliefRow(row: LoanReliefRowState) {
  return (
    !row.name.trim() &&
    !row.amountRepaid.trim() &&
    !row.amountReleasedOrWrittenOff.trim() &&
    !row.date
  );
}

export function isCompleteLoanReliefRow(row: LoanReliefRowState) {
  return (
    row.name.trim().length >= 2 &&
    row.date.length > 0 &&
    (toNullableInteger(row.amountRepaid) != null ||
      toNullableInteger(row.amountReleasedOrWrittenOff) != null)
  );
}

export function payloadString(
  payload: Record<string, unknown> | undefined,
  key: string,
) {
  const value = payload?.[key];
  return typeof value === "string" ? value : null;
}

export function payloadObject(
  payload: Record<string, unknown> | undefined,
  key: string,
) {
  const value = payload?.[key];
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export function payloadArray(
  payload: Record<string, unknown> | undefined,
  key: string,
) {
  const value = payload?.[key];
  return Array.isArray(value) ? value : [];
}

export function payloadNumber(
  payload: Record<string, unknown> | undefined,
  key: string,
) {
  const value = payload?.[key];
  return typeof value === "number" ? value : null;
}

export function describeHmrcCtOutcome(event: SubmissionEvent) {
  return (
    payloadString(event.responsePayload, "summary") ??
    payloadString(event.responsePayload, "bodyStatusText") ??
    payloadString(event.responsePayload, "bodyStatus") ??
    event.errorMessage ??
    "Pending"
  );
}

export function getHmrcCtErrors(event: SubmissionEvent) {
  return payloadArray(event.responsePayload, "errors").filter(
    (item): item is HmrcCtGatewayError =>
      typeof item === "object" && item !== null,
  );
}

export function getHmrcCtNotices(event: SubmissionEvent) {
  return payloadArray(event.responsePayload, "notices").filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

export function describeCompaniesHouseAccountsOutcome(event: SubmissionEvent) {
  const selectedStatus = payloadObject(event.responsePayload, "selectedStatus");
  const rejectionDescription =
    Array.isArray(selectedStatus?.rejections) &&
    typeof selectedStatus.rejections[0] === "object" &&
    selectedStatus.rejections[0] !== null
      ? payloadString(
          selectedStatus.rejections[0] as Record<string, unknown>,
          "description",
        )
      : null;

  return (
    payloadString(selectedStatus ?? undefined, "statusCode") ??
    rejectionDescription ??
    payloadString(selectedStatus ?? undefined, "examinerComment") ??
    event.errorMessage ??
    "Pending"
  );
}
