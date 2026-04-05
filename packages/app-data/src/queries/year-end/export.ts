import {
  upsertYearEndPackInConvex,
} from "../../convex";
import type { Database } from "../../client";
import { buildYearEndExportArchive } from "./export-archive";
import { persistYearEndExportBundle } from "./export-persistence";
import { getTeamContext, getYearEndPack, rebuildYearEndPack } from "./pack";

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

  const archive = await buildYearEndExportArchive({
    team: await getTeamContext(db, params.teamId),
    profile: workspace.profile,
    pack,
    closeCompanyLoansSchedule,
    corporationTaxRateSchedule,
  });
  const exportBundle = await persistYearEndExportBundle({
    teamId: params.teamId,
    periodKey: pack.periodKey,
    archive,
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
