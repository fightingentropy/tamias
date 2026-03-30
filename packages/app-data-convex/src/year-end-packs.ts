import { api, createClient, serviceArgs } from "./base";

const apiWithYearEndPacks = api as typeof api & {
  yearEndPacks: {
    serviceUpsertYearEndPack: any;
    serviceGetYearEndPackByPeriod: any;
  };
};

export type ExportBundleRecord = {
  id: string;
  filePath: string;
  fileName: string;
  checksum: string;
  generatedAt: string;
  manifest: Record<string, unknown>;
};

export type YearEndPackRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  accountsDueDate: string;
  corporationTaxDueDate: string;
  status: "draft" | "ready" | "exported";
  currency: string;
  trialBalance: unknown;
  profitAndLoss: unknown;
  balanceSheet: unknown;
  retainedEarnings: unknown;
  workingPapers: unknown;
  corporationTax: unknown;
  manualJournalCount: number;
  payrollRunCount: number;
  exportBundles: ExportBundleRecord[];
  latestExportedAt: string | null;
  snapshotChecksum: string;
  createdAt: string;
  updatedAt: string;
};

export async function getYearEndPackByPeriodFromConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
}) {
  return createClient().query(
    apiWithYearEndPacks.yearEndPacks.serviceGetYearEndPackByPeriod,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
    }),
  ) as Promise<YearEndPackRecord | null>;
}

export async function upsertYearEndPackInConvex(args: {
  id?: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  accountsDueDate: string;
  corporationTaxDueDate: string;
  status: "draft" | "ready" | "exported";
  currency: string;
  trialBalance: unknown;
  profitAndLoss: unknown;
  balanceSheet: unknown;
  retainedEarnings: unknown;
  workingPapers: unknown;
  corporationTax: unknown;
  manualJournalCount: number;
  payrollRunCount: number;
  exportBundles: ExportBundleRecord[];
  latestExportedAt?: string | null;
  snapshotChecksum: string;
}) {
  return createClient().mutation(
    apiWithYearEndPacks.yearEndPacks.serviceUpsertYearEndPack,
    serviceArgs({
      publicTeamId: args.teamId,
      yearEndPackId: args.id,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      accountsDueDate: args.accountsDueDate,
      corporationTaxDueDate: args.corporationTaxDueDate,
      status: args.status,
      currency: args.currency,
      trialBalance: args.trialBalance,
      profitAndLoss: args.profitAndLoss,
      balanceSheet: args.balanceSheet,
      retainedEarnings: args.retainedEarnings,
      workingPapers: args.workingPapers,
      corporationTax: args.corporationTax,
      manualJournalCount: args.manualJournalCount,
      payrollRunCount: args.payrollRunCount,
      exportBundles: args.exportBundles,
      latestExportedAt: args.latestExportedAt,
      snapshotChecksum: args.snapshotChecksum,
    }),
  ) as Promise<YearEndPackRecord>;
}
