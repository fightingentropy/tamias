import type { ConvexUserId } from "./base";
import { api, createClient, serviceArgs } from "./base";
import type { ExportBundleRecord } from "./year-end-packs";

const apiWithPayrollRuns = api as typeof api & {
  payrollRuns: {
    serviceListPayrollRuns: any;
    serviceGetPayrollRunByPeriod: any;
    serviceUpsertPayrollRun: any;
  };
};

export type PayrollRunRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  runDate: string;
  source: "csv" | "manual";
  status: "imported" | "exported";
  checksum: string;
  currency: string;
  journalEntryId: string;
  lineCount: number;
  liabilityTotals: {
    grossPay: number;
    employerTaxes: number;
    payeLiability: number;
  };
  exportBundles: ExportBundleRecord[];
  latestExportedAt: string | null;
  meta: Record<string, unknown> | null;
  createdBy: ConvexUserId | null;
  createdAt: string;
  updatedAt: string;
};

export async function listPayrollRunsFromConvex(args: { teamId: string }) {
  return createClient().query(
    apiWithPayrollRuns.payrollRuns.serviceListPayrollRuns,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<PayrollRunRecord[]>;
}

export async function getPayrollRunByPeriodFromConvex(args: { teamId: string; periodKey: string }) {
  return createClient().query(
    apiWithPayrollRuns.payrollRuns.serviceGetPayrollRunByPeriod,
    serviceArgs({
      publicTeamId: args.teamId,
      periodKey: args.periodKey,
    }),
  ) as Promise<PayrollRunRecord | null>;
}

export async function upsertPayrollRunInConvex(args: {
  id?: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  runDate: string;
  source: "csv" | "manual";
  status: "imported" | "exported";
  checksum: string;
  currency: string;
  journalEntryId: string;
  lineCount: number;
  liabilityTotals: {
    grossPay: number;
    employerTaxes: number;
    payeLiability: number;
  };
  exportBundles: ExportBundleRecord[];
  latestExportedAt?: string | null;
  meta?: Record<string, unknown> | null;
  createdBy?: ConvexUserId | null;
}) {
  return createClient().mutation(
    apiWithPayrollRuns.payrollRuns.serviceUpsertPayrollRun,
    serviceArgs({
      publicTeamId: args.teamId,
      payrollRunId: args.id,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
      payPeriodStart: args.payPeriodStart,
      payPeriodEnd: args.payPeriodEnd,
      runDate: args.runDate,
      source: args.source,
      status: args.status,
      importChecksum: args.checksum,
      currency: args.currency,
      journalEntryId: args.journalEntryId,
      lineCount: args.lineCount,
      liabilityTotals: args.liabilityTotals,
      exportBundles: args.exportBundles,
      latestExportedAt: args.latestExportedAt,
      meta: args.meta,
      createdBy: args.createdBy,
    }),
  ) as Promise<PayrollRunRecord>;
}
