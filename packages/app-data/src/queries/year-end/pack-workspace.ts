import type {
  CloseCompanyLoansScheduleRecord,
  ComplianceJournalEntryRecord,
  CorporationTaxAdjustmentRecord,
  CorporationTaxRateScheduleRecord,
  FilingProfileRecord,
  PayrollRunRecord,
  YearEndPackRecord,
} from "@tamias/app-data-convex";
import {
  getCloseCompanyLoansScheduleByPeriodFromConvex,
  getCorporationTaxRateScheduleByPeriodFromConvex,
  getYearEndPackByPeriodFromConvex,
  listComplianceJournalEntriesFromConvex,
  listCorporationTaxAdjustmentsForPeriodFromConvex,
  listPayrollRunsFromConvex,
  upsertYearEndPackInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import { getFilingProfile } from "../compliance";
import { listDerivedLedgerEntries } from "../compliance/ledger";
import { buildCt600Draft, buildStatutoryAccountsDraft } from "./drafts";
import { getTeamContext, getYearEndContext } from "./pack-core";
import { buildYearEndPackSnapshot } from "./pack-snapshot";
import { buildEmptyYearEndDashboard, getHmrcCtRuntimeStatus } from "./runtime";
import type { AnnualPeriod, TeamContext, YearEndPeriodContext } from "./types";

async function loadLedgerEntries(db: Database, teamId: string) {
  const [derivedEntries, otherEntries] = await Promise.all([
    listDerivedLedgerEntries(db, {
      teamId,
    }),
    listComplianceJournalEntriesFromConvex({
      teamId,
      sourceTypes: ["manual_adjustment", "payroll_import"],
    }),
  ]);

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

function filterPayrollRunsForPeriod(runs: PayrollRunRecord[], period: AnnualPeriod) {
  return runs.filter(
    (run) => run.payPeriodEnd >= period.periodStart && run.payPeriodEnd <= period.periodEnd,
  );
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

async function getYearEndDashboardImpl(
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
  const [existingPack, manualEntries, corporationTaxAdjustments] = await Promise.all([
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

  const manualJournals = filterManualJournalsForPeriod(manualEntries, context.period);

  return {
    enabled: true,
    team: context.team,
    profile: context.profile,
    period: context.period,
    pack: existingPack,
    ctRuntime: getHmrcCtRuntimeStatus(context.profile),
    manualJournalCount: existingPack?.manualJournalCount ?? manualJournals.length,
    corporationTaxAdjustmentCount:
      existingPack?.corporationTax &&
      typeof existingPack.corporationTax === "object" &&
      existingPack.corporationTax !== null &&
      "adjustments" in existingPack.corporationTax &&
      Array.isArray((existingPack.corporationTax as { adjustments?: unknown[] }).adjustments)
        ? (existingPack.corporationTax as { adjustments: unknown[] }).adjustments.length
        : corporationTaxAdjustments.length,
    latestExportedAt: existingPack?.latestExportedAt ?? null,
  };
}

export const getYearEndDashboard = reuseQueryResult({
  keyPrefix: "year-end-dashboard",
  keyFn: (params: { teamId: string; periodKey?: string }) =>
    [params.teamId, params.periodKey ?? ""].join(":"),
  load: getYearEndDashboardImpl,
});

export async function getYearEndPack(db: Database, params: { teamId: string; periodKey?: string }) {
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
    manualJournals: filterManualJournalsForPeriod(manualEntries, context.period),
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

  const entries = await loadLedgerEntries(db, params.teamId);
  const manualJournals = filterManualJournalsForPeriod(entries, context.period);
  const payrollRunsInPeriod = filterPayrollRunsForPeriod(payrollRuns, context.period);
  const snapshot = buildYearEndPackSnapshot({
    entries,
    period: context.period,
    adjustments: corporationTaxAdjustments,
    rateSchedule: corporationTaxRateSchedule,
    exportBundles: existingPack?.exportBundles,
    latestExportedAt: existingPack?.latestExportedAt,
    currency: context.profile.baseCurrency ?? context.team.baseCurrency ?? "GBP",
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
