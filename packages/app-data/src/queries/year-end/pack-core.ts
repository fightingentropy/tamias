import type { FilingProfileRecord } from "../../convex";
import { upsertComplianceObligationInConvex } from "../../convex";
import { addDays, addMonths, isAfter, isValid } from "date-fns";
import type { Database } from "../../client";
import { getFilingProfile } from "../compliance";
import { getTeamById } from "../teams";
import { coerceDate } from "./formatting";
import { assertUkComplianceEnabled } from "./runtime";
import type { AnnualPeriod, TeamContext, YearEndPeriodContext } from "./types";

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

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const yearValue = match[1];
  const monthValue = match[2];
  const dayValue = match[3];

  if (!yearValue || !monthValue || !dayValue) {
    return null;
  }

  const year = Number.parseInt(yearValue, 10);
  const month = Number.parseInt(monthValue, 10);
  const day = Number.parseInt(dayValue, 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.toISOString().slice(0, 10) === value ? date : null;
}

function resolveYearEndDate(year: number, month: number, day: number) {
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDayOfMonth);

  return new Date(Date.UTC(year, month - 1, safeDay));
}

function resolveReferenceDate(referenceDate?: Date) {
  if (referenceDate && isValid(referenceDate)) {
    return coerceDate(referenceDate);
  }

  return coerceDate(new Date());
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function resolveAnnualPeriod(
  profile: Pick<FilingProfileRecord, "yearEndMonth" | "yearEndDay">,
  options?: {
    periodKey?: string;
    referenceDate?: Date;
  },
): AnnualPeriod {
  const yearEndMonth = profile.yearEndMonth ?? 3;
  const yearEndDay = profile.yearEndDay ?? 31;

  let periodEnd: Date;

  if (options?.periodKey) {
    const parsedPeriodEnd = parseDateKey(options.periodKey);

    if (!parsedPeriodEnd) {
      throw new Error("Invalid year-end period key");
    }

    periodEnd = parsedPeriodEnd;
  } else {
    const referenceDate = resolveReferenceDate(options?.referenceDate);
    const referenceYear = referenceDate.getUTCFullYear();
    const candidate = resolveYearEndDate(
      referenceYear,
      yearEndMonth,
      yearEndDay,
    );
    periodEnd = isAfter(referenceDate, candidate)
      ? resolveYearEndDate(referenceYear + 1, yearEndMonth, yearEndDay)
      : candidate;
  }

  const previousYearEnd = resolveYearEndDate(
    periodEnd.getUTCFullYear() - 1,
    yearEndMonth,
    yearEndDay,
  );
  const periodStart = addDays(previousYearEnd, 1);
  const accountsDueDate = addMonths(periodEnd, 9);
  const corporationTaxDueDate = addDays(addMonths(periodEnd, 9), 1);

  return {
    periodKey: formatDateKey(periodEnd),
    periodStart: formatDateKey(periodStart),
    periodEnd: formatDateKey(periodEnd),
    accountsDueDate: formatDateKey(accountsDueDate),
    corporationTaxDueDate: formatDateKey(corporationTaxDueDate),
  };
}

function determineObligationStatus(dueDate: string) {
  const today = formatDateKey(coerceDate(new Date()));
  return today > dueDate ? "overdue" : "open";
}

async function ensureAnnualObligations(
  teamId: string,
  profile: FilingProfileRecord,
  period: AnnualPeriod,
): Promise<YearEndPeriodContext["obligations"]> {
  const [accounts, corporationTax] = await Promise.all([
    upsertComplianceObligationInConvex({
      teamId,
      filingProfileId: profile.id,
      provider: "companies-house",
      obligationType: "accounts",
      periodKey: period.periodKey,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      dueDate: period.accountsDueDate,
      status: determineObligationStatus(period.accountsDueDate),
      externalId: `${profile.id}:accounts:${period.periodKey}`,
      raw: {
        generatedBy: "tamias",
        kind: "annual_internal_obligation",
      },
    }),
    upsertComplianceObligationInConvex({
      teamId,
      filingProfileId: profile.id,
      provider: "hmrc-ct",
      obligationType: "corporation_tax",
      periodKey: period.periodKey,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      dueDate: period.corporationTaxDueDate,
      status: determineObligationStatus(period.corporationTaxDueDate),
      externalId: `${profile.id}:corporation_tax:${period.periodKey}`,
      raw: {
        generatedBy: "tamias",
        kind: "annual_internal_obligation",
      },
    }),
  ]);

  return {
    accounts,
    corporationTax,
  };
}

export async function getYearEndContext(
  db: Database,
  teamId: string,
  periodKey?: string,
) {
  const team = await getTeamContext(db, teamId);
  const profile = await getFilingProfile(db, teamId);

  if (!profile) {
    throw new Error("Filing profile not configured");
  }

  assertUkComplianceEnabled(team, profile);

  const period = resolveAnnualPeriod(profile, { periodKey });
  const obligations = await ensureAnnualObligations(teamId, profile, period);

  return {
    team,
    profile,
    period: {
      ...period,
      obligations,
    },
  };
}
