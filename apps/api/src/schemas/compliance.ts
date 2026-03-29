import {
  AccountingBasisSchema,
  CloseCompanyLoanEntrySchema,
  CloseCompanyLoanReliefEntrySchema,
  CorporationTaxRateScheduleSchema,
  CorporationTaxAdjustmentCategorySchema,
  FilingModeSchema,
  LegalEntityTypeSchema,
  VatSchemeSchema,
} from "@tamias/compliance";
import { z } from "zod";

const nullableString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null) {
      return null;
    }

    return value.length > 0 ? value : null;
  });

const nullableDateString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null) {
      return null;
    }

    return value.length > 0 ? value : null;
  })
  .pipe(z.string().date().nullable());

const nullableInteger = z
  .number()
  .int()
  .min(0)
  .optional()
  .nullable()
  .transform((value) => value ?? null);

const nullableAmount = z
  .number()
  .min(0)
  .optional()
  .nullable()
  .transform((value) => value ?? null);

const nullableBoolean = z
  .boolean()
  .optional()
  .nullable()
  .transform((value) => value ?? null);

export const getVatDraftSchema = z
  .object({
    obligationId: z.string().optional(),
    vatReturnId: z.string().optional(),
  })
  .optional();

export const recalculateVatDraftSchema = z
  .object({
    obligationId: z.string().optional(),
    vatReturnId: z.string().optional(),
  })
  .optional();

export const upsertFilingProfileSchema = z.object({
  provider: z.literal("hmrc-vat").optional(),
  enabled: z.boolean(),
  legalEntityType: LegalEntityTypeSchema.optional(),
  companyName: nullableString,
  companyNumber: nullableString,
  companyAuthenticationCode: nullableString,
  utr: nullableString,
  vrn: nullableString,
  vatScheme: VatSchemeSchema.nullable().optional(),
  accountingBasis: AccountingBasisSchema.optional(),
  filingMode: FilingModeSchema.optional(),
  agentReferenceNumber: nullableString,
  yearEndMonth: z.number().int().min(1).max(12).nullable().optional(),
  yearEndDay: z.number().int().min(1).max(31).nullable().optional(),
  baseCurrency: nullableString,
  principalActivity: nullableString,
  directors: z
    .array(z.string().trim().min(1))
    .max(40)
    .optional()
    .transform((value) => value ?? []),
  signingDirectorName: nullableString,
  approvalDate: nullableDateString,
  averageEmployeeCount: nullableInteger,
  ordinaryShareCount: nullableInteger,
  ordinaryShareNominalValue: nullableAmount,
  dormant: nullableBoolean,
  auditExemptionClaimed: nullableBoolean,
  membersDidNotRequireAudit: nullableBoolean,
  directorsAcknowledgeResponsibilities: nullableBoolean,
  accountsPreparedUnderSmallCompaniesRegime: nullableBoolean,
});

export const addVatAdjustmentSchema = z.object({
  obligationId: z.string().optional(),
  vatReturnId: z.string().optional(),
  lineCode: z.enum([
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
  reason: z.string().trim().min(1),
  note: nullableString,
  effectiveDate: z.string().date(),
});

export const submitVatReturnSchema = z.object({
  vatReturnId: z.string(),
  declarationAccepted: z.literal(true),
  userAgent: z.string().trim().optional(),
  publicIp: z.string().trim().optional(),
});

export const getEvidencePackSchema = z.object({
  evidencePackId: z.string(),
});

const yearEndPeriodSchema = z
  .object({
    periodKey: z.string().date().optional(),
  })
  .optional();

export const getYearEndPackSchema = yearEndPeriodSchema;
export const rebuildYearEndPackSchema = yearEndPeriodSchema;
export const generateYearEndExportSchema = yearEndPeriodSchema;
export const listYearEndCtSubmissionsSchema = yearEndPeriodSchema;
export const listYearEndAccountsSubmissionsSchema = yearEndPeriodSchema;
export const submitYearEndCt600Schema = z.object({
  periodKey: z.string().date().optional(),
  declarationAccepted: z.literal(true),
});
export const submitYearEndAccountsSchema = z.object({
  periodKey: z.string().date().optional(),
  declarationAccepted: z.literal(true),
});
export const pollYearEndCt600Schema = z
  .object({
    periodKey: z.string().date().optional(),
    correlationId: z.string().trim().optional(),
    responseEndpoint: nullableString,
  })
  .optional();
export const pollYearEndAccountsSchema = z
  .object({
    periodKey: z.string().date().optional(),
    submissionNumber: z.string().trim().optional(),
  })
  .optional();

export const upsertYearEndManualJournalSchema = z.object({
  id: z.string().uuid().optional(),
  effectiveDate: z.string().date(),
  description: z.string().trim().min(1),
  reference: nullableString,
  lines: z
    .array(
      z.object({
        accountCode: z.string().trim().min(1),
        description: nullableString,
        debit: z.number().min(0),
        credit: z.number().min(0),
      }),
    )
    .min(2),
});

export const deleteYearEndManualJournalSchema = z.object({
  journalId: z.string().uuid(),
  periodKey: z.string().date().optional(),
});

export const upsertCorporationTaxAdjustmentSchema = z.object({
  id: z.string().uuid().optional(),
  periodKey: z.string().date().optional(),
  category: CorporationTaxAdjustmentCategorySchema.optional(),
  label: z.string().trim().min(1),
  amount: z.number(),
  note: nullableString,
});

export const deleteCorporationTaxAdjustmentSchema = z.object({
  adjustmentId: z.string().uuid(),
  periodKey: z.string().date().optional(),
});

export const upsertCloseCompanyLoansScheduleSchema = z.object({
  periodKey: z.string().date().optional(),
  beforeEndPeriod: z.boolean(),
  loansMade: z.array(CloseCompanyLoanEntrySchema).max(999),
  taxChargeable: z.number().positive().nullable(),
  reliefEarlierThan: z.array(CloseCompanyLoanReliefEntrySchema).max(999),
  reliefEarlierDue: z.number().positive().nullable(),
  loanLaterReliefNow: z.array(CloseCompanyLoanReliefEntrySchema).max(999),
  reliefLaterDue: z.number().positive().nullable(),
  totalLoansOutstanding: z.number().int().positive().nullable(),
});

export const deleteCloseCompanyLoansScheduleSchema = z.object({
  periodKey: z.string().date().optional(),
});

export const upsertCorporationTaxRateScheduleSchema =
  CorporationTaxRateScheduleSchema.extend({
    periodKey: z.string().date().optional(),
  });

export const deleteCorporationTaxRateScheduleSchema = z.object({
  periodKey: z.string().date().optional(),
});

export const generatePayrollExportSchema = z
  .object({
    periodKey: z.string().optional(),
  })
  .optional();

export const importPayrollRunSchema = z.object({
  source: z.enum(["csv", "manual"]),
  payPeriodStart: z.string().date(),
  payPeriodEnd: z.string().date(),
  runDate: z.string().date(),
  currency: nullableString,
  csvContent: nullableString,
  lines: z
    .array(
      z.object({
        accountCode: z.string().trim().min(1),
        description: nullableString,
        debit: z.number().min(0),
        credit: z.number().min(0),
      }),
    )
    .optional(),
});
