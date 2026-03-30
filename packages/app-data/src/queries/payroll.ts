import { createHash } from "node:crypto";
import { PassThrough } from "node:stream";
import { writeToString } from "@fast-csv/format";
import { isUkComplianceVisible, roundCurrency } from "@tamias/compliance";
import type {
  ComplianceJournalEntryRecord,
  CurrentUserIdentityRecord,
  PayrollRunRecord,
} from "@tamias/app-data-convex";
import {
  getPayrollRunByPeriodFromConvex,
  listComplianceJournalEntriesFromConvex,
  listPayrollRunsFromConvex,
  upsertComplianceJournalEntryInConvex,
  upsertPayrollRunInConvex,
} from "@tamias/app-data-convex";
import { uploadVaultFile } from "@tamias/storage";
import archiver from "archiver";
import { parseISO } from "date-fns";
import type { Database } from "../client";
import { getFilingProfile } from "./compliance";
import { getTeamById } from "./teams";
import { cacheAcrossRequests } from "../utils/short-lived-cache";

type TeamContext = {
  id: string;
  name: string | null;
  countryCode: string | null;
  baseCurrency: string | null;
};

type PayrollImportLine = {
  accountCode: string;
  description?: string | null;
  debit: number;
  credit: number;
};

type PayrollImportParams = {
  teamId: string;
  createdBy: CurrentUserIdentityRecord["convexId"];
  source: "csv" | "manual";
  payPeriodStart: string;
  payPeriodEnd: string;
  runDate: string;
  currency?: string | null;
  csvContent?: string | null;
  lines?: PayrollImportLine[];
};

function buildEmptyPayrollDashboard(args: {
  team: TeamContext;
  profile: Awaited<ReturnType<typeof getFilingProfile>>;
}) {
  return {
    enabled: isUkComplianceVisible({
      countryCode: args.team.countryCode,
      profileEnabled: args.profile?.enabled,
    }),
    team: args.team,
    profile: args.profile,
    summary: {
      currency: args.team.baseCurrency ?? "GBP",
      importedRunCount: 0,
      latestRunAt: null,
      payeLiability: 0,
    },
    latestRun: null,
  };
}

function assertUkComplianceEnabled(
  team: TeamContext,
  profile?: { enabled: boolean } | null,
) {
  const visible = isUkComplianceVisible({
    countryCode: team.countryCode,
    profileEnabled: profile?.enabled,
  });

  if (!visible) {
    throw new Error("UK compliance is not enabled for this team");
  }
}

async function getTeamContext(
  db: Database,
  teamId: string,
): Promise<TeamContext> {
  const team = await getTeamById(db, teamId);

  if (!team) {
    throw new Error("Team not found");
  }

  return {
    id: team.id,
    name: team.name,
    countryCode: team.countryCode,
    baseCurrency: team.baseCurrency,
  };
}

function ensureDateString(value: string, label: string) {
  const parsed = parseISO(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date`);
  }
}

function validateBalancedLines(lines: PayrollImportLine[]) {
  if (lines.length < 2) {
    throw new Error("At least two payroll journal lines are required");
  }

  const debitTotal = roundCurrency(
    lines.reduce((total, line) => total + line.debit, 0),
  );
  const creditTotal = roundCurrency(
    lines.reduce((total, line) => total + line.credit, 0),
  );

  if (debitTotal <= 0 || creditTotal <= 0) {
    throw new Error(
      "Payroll journal must include both debit and credit values",
    );
  }

  if (Math.abs(debitTotal - creditTotal) > 0.009) {
    throw new Error("Payroll journal must balance");
  }
}

function buildPayrollPeriodKey(payPeriodStart: string, payPeriodEnd: string) {
  return `${payPeriodStart}:${payPeriodEnd}`;
}

function splitCsvRow(input: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character === '"') {
      const nextCharacter = input[index + 1];

      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());

  return values;
}

export function parsePayrollCsv(csvContent: string) {
  const rows = csvContent
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);

  if (rows.length < 2) {
    throw new Error(
      "Payroll CSV must include a header and at least one data row",
    );
  }

  const headers = splitCsvRow(rows[0] ?? "").map((header) =>
    header.toLowerCase(),
  );
  const accountCodeIndex = headers.indexOf("accountcode");
  const debitIndex = headers.indexOf("debit");
  const creditIndex = headers.indexOf("credit");
  const descriptionIndex = headers.indexOf("description");

  if (accountCodeIndex < 0 || debitIndex < 0 || creditIndex < 0) {
    throw new Error(
      "Payroll CSV must include accountCode, debit, and credit columns",
    );
  }

  return rows.slice(1).map((row, rowIndex) => {
    const columns = splitCsvRow(row);
    const accountCode = columns[accountCodeIndex]?.trim();
    const debit = Number(columns[debitIndex] ?? 0);
    const credit = Number(columns[creditIndex] ?? 0);

    if (!accountCode) {
      throw new Error(`Payroll CSV row ${rowIndex + 2} is missing accountCode`);
    }

    if (Number.isNaN(debit) || Number.isNaN(credit)) {
      throw new Error(`Payroll CSV row ${rowIndex + 2} has an invalid amount`);
    }

    return {
      accountCode,
      description:
        descriptionIndex >= 0
          ? columns[descriptionIndex]?.trim() || null
          : null,
      debit: roundCurrency(debit),
      credit: roundCurrency(credit),
    } satisfies PayrollImportLine;
  });
}

export function buildPayrollLiabilityTotals(lines: PayrollImportLine[]) {
  return {
    grossPay: roundCurrency(
      lines
        .filter((line) => line.accountCode === "6100")
        .reduce((total, line) => total + line.debit - line.credit, 0),
    ),
    employerTaxes: roundCurrency(
      lines
        .filter((line) => line.accountCode === "6110")
        .reduce((total, line) => total + line.debit - line.credit, 0),
    ),
    payeLiability: roundCurrency(
      lines
        .filter((line) => line.accountCode === "2210")
        .reduce((total, line) => total + line.credit - line.debit, 0),
    ),
  };
}

async function getPayrollContext(db: Database, teamId: string) {
  const team = await getTeamContext(db, teamId);
  const profile = await getFilingProfile(db, teamId);

  if (!profile) {
    throw new Error("Filing profile not configured");
  }

  assertUkComplianceEnabled(team, profile);

  return { team, profile };
}

function buildPayrollRunChecksum(args: {
  source: "csv" | "manual";
  payPeriodStart: string;
  payPeriodEnd: string;
  runDate: string;
  lines: PayrollImportLine[];
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        source: args.source,
        payPeriodStart: args.payPeriodStart,
        payPeriodEnd: args.payPeriodEnd,
        runDate: args.runDate,
        lines: args.lines,
      }),
    )
    .digest("hex");
}

function buildLiabilitySummary(runs: PayrollRunRecord[], currency: string) {
  return {
    currency,
    importedRunCount: runs.length,
    latestRunAt: runs[0]?.runDate ?? null,
    payeLiability: roundCurrency(
      runs.reduce((total, run) => total + run.liabilityTotals.payeLiability, 0),
    ),
  };
}

async function getPayrollDashboardImpl(
  db: Database,
  params: { teamId: string },
) {
  const team = await getTeamContext(db, params.teamId);
  const profile = await getFilingProfile(db, params.teamId);

  if (!profile) {
    return buildEmptyPayrollDashboard({
      team,
      profile,
    });
  }

  const context = await getPayrollContext(db, params.teamId);
  const runs = await listPayrollRunsFromConvex({
    teamId: params.teamId,
  });

  return {
    enabled: true,
    team: context.team,
    profile: context.profile,
    summary: buildLiabilitySummary(
      runs,
      context.profile.baseCurrency ?? context.team.baseCurrency ?? "GBP",
    ),
    latestRun: runs[0] ?? null,
  };
}

export const getPayrollDashboard = cacheAcrossRequests({
  keyPrefix: "payroll-dashboard",
  keyFn: (params: { teamId: string }) => params.teamId,
  load: getPayrollDashboardImpl,
});

export async function listPayrollRuns(
  db: Database,
  params: { teamId: string },
) {
  void db;
  return listPayrollRunsFromConvex({
    teamId: params.teamId,
  });
}

async function listPayrollJournalEntries(teamId: string) {
  return listComplianceJournalEntriesFromConvex({
    teamId,
    sourceTypes: ["payroll_import"],
  });
}

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

async function buildZipBundle(files: Array<{ name: string; data: Buffer }>) {
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

  const journalEntries = (
    await listPayrollJournalEntries(params.teamId)
  ).filter((entry) => entry.sourceId === run.id);
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
