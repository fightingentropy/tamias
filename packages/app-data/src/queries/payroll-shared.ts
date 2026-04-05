import { createHash } from "node:crypto";
import { isUkComplianceVisible, roundCurrency } from "@tamias/compliance";
import type {
  ComplianceJournalEntryRecord,
  CurrentUserIdentityRecord,
  PayrollRunRecord,
} from "@tamias/app-data-convex";
import { listComplianceJournalEntriesFromConvex } from "@tamias/app-data-convex";
import { parseISO } from "date-fns";
import type { Database } from "../client";
import { getFilingProfile } from "./compliance";
import { getTeamById } from "./teams";

export type TeamContext = {
  id: string;
  name: string | null;
  countryCode: string | null;
  baseCurrency: string | null;
};

export type PayrollImportLine = {
  accountCode: string;
  description?: string | null;
  debit: number;
  credit: number;
};

export type PayrollImportParams = {
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

export function buildEmptyPayrollDashboard(args: {
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

export function assertUkComplianceEnabled(
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

export async function getTeamContext(
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

export async function getPayrollContext(db: Database, teamId: string) {
  const team = await getTeamContext(db, teamId);
  const profile = await getFilingProfile(db, teamId);

  if (!profile) {
    throw new Error("Filing profile not configured");
  }

  assertUkComplianceEnabled(team, profile);

  return { team, profile };
}

export function ensureDateString(value: string, label: string) {
  const parsed = parseISO(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date`);
  }
}

export function validateBalancedLines(lines: PayrollImportLine[]) {
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

export function buildPayrollPeriodKey(
  payPeriodStart: string,
  payPeriodEnd: string,
) {
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

export function buildPayrollRunChecksum(args: {
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

export function buildLiabilitySummary(
  runs: PayrollRunRecord[],
  currency: string,
) {
  return {
    currency,
    importedRunCount: runs.length,
    latestRunAt: runs[0]?.runDate ?? null,
    payeLiability: roundCurrency(
      runs.reduce((total, run) => total + run.liabilityTotals.payeLiability, 0),
    ),
  };
}

export async function listPayrollJournalEntries(teamId: string) {
  return listComplianceJournalEntriesFromConvex({
    teamId,
    sourceTypes: ["payroll_import"],
  });
}

export type PayrollJournalEntry = ComplianceJournalEntryRecord;
