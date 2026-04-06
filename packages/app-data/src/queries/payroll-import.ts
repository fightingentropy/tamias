import {
  getPayrollRunByPeriodFromConvex,
  listPayrollRunsFromConvex,
  upsertComplianceJournalEntryInConvex,
  upsertPayrollRunInConvex,
} from "@tamias/app-data-convex";
import { roundCurrency } from "@tamias/compliance";
import type { Database } from "../client";
import {
  buildLiabilitySummary,
  buildPayrollLiabilityTotals,
  buildPayrollPeriodKey,
  buildPayrollRunChecksum,
  ensureDateString,
  getPayrollContext,
  parsePayrollCsv,
  type PayrollImportParams,
  validateBalancedLines,
} from "./payroll-shared";

export async function importPayrollRun(
  db: Database,
  params: PayrollImportParams,
) {
  ensureDateString(params.payPeriodStart, "Pay period start");
  ensureDateString(params.payPeriodEnd, "Pay period end");
  ensureDateString(params.runDate, "Run date");

  const context = await getPayrollContext(db, params.teamId);
  const normalizedLines =
    params.source === "csv"
      ? parsePayrollCsv(params.csvContent ?? "")
      : (params.lines ?? []).map((line) => ({
          accountCode: line.accountCode.trim(),
          description: line.description ?? null,
          debit: roundCurrency(line.debit),
          credit: roundCurrency(line.credit),
        }));

  validateBalancedLines(normalizedLines);

  const periodKey = buildPayrollPeriodKey(
    params.payPeriodStart,
    params.payPeriodEnd,
  );
  const existingRun = await getPayrollRunByPeriodFromConvex({
    teamId: params.teamId,
    periodKey,
  });
  const payrollRunId = existingRun?.id ?? crypto.randomUUID();
  const liabilityTotals = buildPayrollLiabilityTotals(normalizedLines);
  const checksum = buildPayrollRunChecksum({
    source: params.source,
    payPeriodStart: params.payPeriodStart,
    payPeriodEnd: params.payPeriodEnd,
    runDate: params.runDate,
    lines: normalizedLines,
  });
  const currency =
    params.currency ??
    context.profile.baseCurrency ??
    context.team.baseCurrency ??
    "GBP";

  await upsertComplianceJournalEntryInConvex({
    teamId: params.teamId,
    entry: {
      journalEntryId: payrollRunId,
      entryDate: params.runDate,
      reference: periodKey,
      description: `Payroll import ${params.payPeriodStart} to ${params.payPeriodEnd}`,
      sourceType: "payroll_import",
      sourceId: payrollRunId,
      currency,
      meta: {
        checksum,
        createdBy: params.createdBy,
        payPeriodStart: params.payPeriodStart,
        payPeriodEnd: params.payPeriodEnd,
        source: params.source,
      },
      lines: normalizedLines,
    },
  });

  const run = await upsertPayrollRunInConvex({
    id: existingRun?.id,
    teamId: params.teamId,
    filingProfileId: context.profile.id,
    periodKey,
    payPeriodStart: params.payPeriodStart,
    payPeriodEnd: params.payPeriodEnd,
    runDate: params.runDate,
    source: params.source,
    status:
      (existingRun?.exportBundles.length ?? 0) > 0 ? "exported" : "imported",
    checksum,
    currency,
    journalEntryId: payrollRunId,
    lineCount: normalizedLines.length,
    liabilityTotals,
    exportBundles: existingRun?.exportBundles ?? [],
    latestExportedAt: existingRun?.latestExportedAt ?? null,
    meta: {
      checksum,
      importedBy: params.createdBy,
    },
    createdBy: params.createdBy,
  });

  return {
    run,
    summary: buildLiabilitySummary(
      await listPayrollRunsFromConvex({
        teamId: params.teamId,
      }),
      currency,
    ),
  };
}
