import type { ConvexUserId } from "./base";
import { api, createClient, serviceArgs } from "./base";

const apiWithComplianceAdjustments = api as typeof api & {
  complianceAdjustments: {
    serviceListComplianceAdjustmentsForPeriod: any;
    serviceCountComplianceAdjustmentsByVatReturnId: any;
    serviceCreateComplianceAdjustment: any;
  };
};

const apiWithComplianceLedger = api as typeof api & {
  complianceLedger: {
    serviceListComplianceJournalEntries: any;
    serviceUpsertComplianceJournalEntry: any;
    serviceDeleteComplianceJournalEntryBySource: any;
    serviceRebuildDerivedComplianceJournalEntries: any;
  };
};

export type ComplianceAdjustmentLineCode =
  | "box1"
  | "box2"
  | "box3"
  | "box4"
  | "box5"
  | "box6"
  | "box7"
  | "box8"
  | "box9";

export type ComplianceAdjustmentRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  vatReturnId: string | null;
  obligationId: string | null;
  effectiveDate: string;
  lineCode: ComplianceAdjustmentLineCode;
  amount: number;
  reason: string;
  note: string | null;
  createdBy: ConvexUserId | null;
  meta: unknown;
  createdAt: string;
};

export type ComplianceJournalSourceType =
  | "transaction"
  | "invoice"
  | "invoice_refund"
  | "manual_adjustment"
  | "payroll_import";

export type ComplianceJournalLineRecord = {
  accountCode: string;
  description?: string | null;
  debit?: number;
  credit?: number;
  taxRate?: number | null;
  taxAmount?: number | null;
  taxType?: string | null;
  vatBox?: string | null;
  meta?: Record<string, unknown> | null;
};

export type ComplianceJournalEntryRecord = {
  journalEntryId: string;
  entryDate: string;
  reference?: string | null;
  description?: string | null;
  sourceType: ComplianceJournalSourceType;
  sourceId: string;
  currency: string;
  meta?: Record<string, unknown> | null;
  lines: ComplianceJournalLineRecord[];
};

export async function rebuildDerivedComplianceJournalEntriesInConvex(args: {
  teamId?: string | null;
}) {
  return createClient().mutation(
    apiWithComplianceLedger.complianceLedger.serviceRebuildDerivedComplianceJournalEntries,
    serviceArgs({
      publicTeamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      transactionCount: number;
      invoiceCount: number;
      journalEntryCount: number;
    }>
  >;
}

export async function listComplianceJournalEntriesFromConvex(args: {
  teamId: string;
  sourceTypes?: ComplianceJournalSourceType[];
}) {
  return createClient().query(
    apiWithComplianceLedger.complianceLedger.serviceListComplianceJournalEntries,
    serviceArgs({
      publicTeamId: args.teamId,
      sourceTypes: args.sourceTypes,
    }),
  ) as Promise<ComplianceJournalEntryRecord[]>;
}

export async function upsertComplianceJournalEntryInConvex(args: {
  teamId: string;
  entry: ComplianceJournalEntryRecord;
}) {
  return createClient().mutation(
    apiWithComplianceLedger.complianceLedger.serviceUpsertComplianceJournalEntry,
    serviceArgs({
      publicTeamId: args.teamId,
      entry: {
        journalEntryId: args.entry.journalEntryId,
        entryDate: args.entry.entryDate,
        reference: args.entry.reference ?? undefined,
        description: args.entry.description ?? undefined,
        sourceType: args.entry.sourceType,
        sourceId: args.entry.sourceId,
        currency: args.entry.currency,
        meta: args.entry.meta ?? undefined,
        lines: args.entry.lines.map((line) => ({
          accountCode: line.accountCode,
          description: line.description ?? undefined,
          debit: line.debit ?? 0,
          credit: line.credit ?? 0,
          taxRate: line.taxRate ?? undefined,
          taxAmount: line.taxAmount ?? undefined,
          taxType: line.taxType ?? undefined,
          vatBox: line.vatBox ?? undefined,
          meta: line.meta ?? undefined,
        })),
      },
    }),
  ) as Promise<{ journalEntryId: string; updated: boolean }>;
}

export async function deleteComplianceJournalEntryBySourceInConvex(args: {
  teamId: string;
  sourceType: ComplianceJournalSourceType;
  sourceId: string;
}) {
  return createClient().mutation(
    apiWithComplianceLedger.complianceLedger.serviceDeleteComplianceJournalEntryBySource,
    serviceArgs({
      publicTeamId: args.teamId,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
    }),
  ) as Promise<{ deleted: boolean; journalEntryId?: string }>;
}

export async function getComplianceAdjustmentsForPeriodFromConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodStart: string;
  periodEnd: string;
}) {
  return createClient().query(
    apiWithComplianceAdjustments.complianceAdjustments.serviceListComplianceAdjustmentsForPeriod,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
    }),
  ) as Promise<ComplianceAdjustmentRecord[]>;
}

export async function countComplianceAdjustmentsByVatReturnIdFromConvex(args: {
  teamId: string;
  vatReturnId: string;
}) {
  return createClient().query(
    apiWithComplianceAdjustments.complianceAdjustments
      .serviceCountComplianceAdjustmentsByVatReturnId,
    serviceArgs({
      publicTeamId: args.teamId,
      vatReturnId: args.vatReturnId,
    }),
  ) as Promise<number>;
}

export async function createComplianceAdjustmentInConvex(args: {
  id?: string;
  teamId: string;
  filingProfileId: string;
  vatReturnId?: string | null;
  obligationId?: string | null;
  effectiveDate: string;
  lineCode: ComplianceAdjustmentLineCode;
  amount: number;
  reason: string;
  note?: string | null;
  createdBy?: ConvexUserId | null;
  meta?: Record<string, unknown> | null;
}) {
  return createClient().mutation(
    apiWithComplianceAdjustments.complianceAdjustments.serviceCreateComplianceAdjustment,
    serviceArgs({
      publicTeamId: args.teamId,
      complianceAdjustmentId: args.id,
      filingProfileId: args.filingProfileId,
      vatReturnId: args.vatReturnId,
      obligationId: args.obligationId,
      effectiveDate: args.effectiveDate,
      lineCode: args.lineCode,
      amount: args.amount,
      reason: args.reason,
      note: args.note,
      createdBy: args.createdBy,
      meta: args.meta,
    }),
  ) as Promise<ComplianceAdjustmentRecord>;
}
