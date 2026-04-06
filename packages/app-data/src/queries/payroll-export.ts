import { createHash } from "node:crypto";
import { PassThrough } from "node:stream";
import { writeToString } from "@fast-csv/format";
import {
  listPayrollRunsFromConvex,
  type ComplianceJournalEntryRecord,
  type PayrollRunRecord,
  upsertPayrollRunInConvex,
} from "@tamias/app-data-convex";
import { uploadVaultFile } from "@tamias/storage";
import type { Database } from "../client";
import {
  buildLiabilitySummary,
  getPayrollContext,
  listPayrollJournalEntries,
} from "./payroll-shared";

async function buildZipBundle(files: Array<{ name: string; data: Buffer }>) {
  const { default: archiver } = await import("archiver");

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = new PassThrough();

    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", reject);
    archive.pipe(stream);

    for (const file of files) {
      archive.append(file.data, { name: file.name });
    }

    archive.finalize();
  });
}

async function createPayrollExportBundle(args: {
  teamId: string;
  run: PayrollRunRecord;
  journalEntries: ComplianceJournalEntryRecord[];
}) {
  const runsCsv = await writeToString(
    [
      {
        periodKey: args.run.periodKey,
        payPeriodStart: args.run.payPeriodStart,
        payPeriodEnd: args.run.payPeriodEnd,
        runDate: args.run.runDate,
        source: args.run.source,
        grossPay: args.run.liabilityTotals.grossPay,
        employerTaxes: args.run.liabilityTotals.employerTaxes,
        payeLiability: args.run.liabilityTotals.payeLiability,
      },
    ],
    { headers: true },
  );
  const journalsCsv = await writeToString(
    args.journalEntries.flatMap((entry) =>
      entry.lines.map((line) => ({
        sourceId: entry.sourceId,
        entryDate: entry.entryDate,
        accountCode: line.accountCode,
        description: line.description ?? "",
        debit: line.debit ?? 0,
        credit: line.credit ?? 0,
      })),
    ),
    { headers: true },
  );
  const liabilityCsv = await writeToString(
    [
      {
        currency: args.run.currency,
        payeLiability: args.run.liabilityTotals.payeLiability,
        grossPay: args.run.liabilityTotals.grossPay,
        employerTaxes: args.run.liabilityTotals.employerTaxes,
      },
    ],
    { headers: true },
  );
  const manifest = {
    payrollRunId: args.run.id,
    periodKey: args.run.periodKey,
    generatedAt: new Date().toISOString(),
    checksum: args.run.checksum,
    files: [
      { name: "payroll-runs.csv" },
      { name: "payroll-journals.csv" },
      { name: "liability-summary.csv" },
    ],
  };
  const zipBuffer = await buildZipBundle([
    {
      name: "payroll-runs.csv",
      data: Buffer.from(runsCsv, "utf8"),
    },
    {
      name: "payroll-journals.csv",
      data: Buffer.from(journalsCsv, "utf8"),
    },
    {
      name: "liability-summary.csv",
      data: Buffer.from(liabilityCsv, "utf8"),
    },
    {
      name: "manifest.json",
      data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
    },
  ]);
  const generatedAt = new Date().toISOString();
  const fileName = `payroll-${args.run.payPeriodEnd}-${generatedAt.slice(0, 10)}.zip`;
  const filePath = `${args.teamId}/compliance/payroll/${args.run.periodKey}/${fileName}`;
  const uploadResult = await uploadVaultFile({
    path: filePath,
    blob: zipBuffer,
    contentType: "application/zip",
    size: zipBuffer.length,
  });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  return {
    id: crypto.randomUUID(),
    filePath,
    fileName,
    checksum: createHash("sha256").update(zipBuffer).digest("hex"),
    generatedAt,
    manifest,
  };
}

export async function generatePayrollExport(
  db: Database,
  params: { teamId: string; periodKey?: string },
) {
  const context = await getPayrollContext(db, params.teamId);
  const runs = await listPayrollRunsFromConvex({
    teamId: params.teamId,
  });
  const run =
    (params.periodKey
      ? runs.find((candidate) => candidate.periodKey === params.periodKey)
      : runs[0]) ?? null;

  if (!run) {
    throw new Error("Payroll run not found");
  }

  const journalEntries = (await listPayrollJournalEntries(params.teamId)).filter(
    (entry) => entry.sourceId === run.id,
  );
  const exportBundle = await createPayrollExportBundle({
    teamId: params.teamId,
    run,
    journalEntries,
  });
  const updatedRun = await upsertPayrollRunInConvex({
    id: run.id,
    teamId: params.teamId,
    filingProfileId: run.filingProfileId,
    periodKey: run.periodKey,
    payPeriodStart: run.payPeriodStart,
    payPeriodEnd: run.payPeriodEnd,
    runDate: run.runDate,
    source: run.source,
    status: "exported",
    checksum: run.checksum,
    currency: run.currency,
    journalEntryId: run.journalEntryId,
    lineCount: run.lineCount,
    liabilityTotals: run.liabilityTotals,
    exportBundles: [...run.exportBundles, exportBundle],
    latestExportedAt: exportBundle.generatedAt,
    meta: run.meta,
    createdBy: run.createdBy,
  });

  return {
    run: updatedRun,
    summary: buildLiabilitySummary(
      await listPayrollRunsFromConvex({
        teamId: params.teamId,
      }),
      context.profile.baseCurrency ?? context.team.baseCurrency ?? "GBP",
    ),
  };
}
