import { roundCurrency } from "@tamias/compliance";
import {
  deleteComplianceJournalEntryBySourceInConvex,
  upsertComplianceJournalEntryInConvex,
  type CurrentUserIdentityRecord,
} from "../../../convex";
import { parseISO } from "date-fns";
import type { Database } from "../../../client";
import { getFilingProfile } from "../../compliance";
import { getTeamContext, resolveAnnualPeriod, validateBalancedLines } from "../pack";
import { assertUkComplianceEnabled } from "../runtime";
import type { ManualJournalInput } from "../types";
import { rebuildYearEndMutationPack } from "./common";

export async function upsertYearEndManualJournal(
  db: Database,
  params: {
    teamId: string;
    createdBy: CurrentUserIdentityRecord["convexId"];
  } & ManualJournalInput,
) {
  const team = await getTeamContext(db, params.teamId);
  const profile = await getFilingProfile(db, params.teamId);

  if (!profile) {
    throw new Error("Filing profile not configured");
  }

  assertUkComplianceEnabled(team, profile);
  validateBalancedLines(params.lines);

  const period = resolveAnnualPeriod(profile, {
    referenceDate: parseISO(params.effectiveDate),
  });
  const sourceId = params.id ?? crypto.randomUUID();

  await upsertComplianceJournalEntryInConvex({
    teamId: params.teamId,
    entry: {
      journalEntryId: sourceId,
      entryDate: params.effectiveDate,
      reference: params.reference ?? null,
      description: params.description,
      sourceType: "manual_adjustment",
      sourceId,
      currency: profile.baseCurrency ?? team.baseCurrency ?? "GBP",
      meta: {
        createdBy: params.createdBy,
        kind: "year_end_manual_journal",
        periodKey: period.periodKey,
      },
      lines: params.lines.map((line) => ({
        accountCode: line.accountCode.trim(),
        description: line.description ?? null,
        debit: roundCurrency(line.debit),
        credit: roundCurrency(line.credit),
      })),
    },
  });

  return rebuildYearEndMutationPack({
    db,
    teamId: params.teamId,
    periodKey: period.periodKey,
  });
}

export async function deleteYearEndManualJournal(
  db: Database,
  params: {
    teamId: string;
    journalId: string;
    periodKey?: string;
  },
) {
  await deleteComplianceJournalEntryBySourceInConvex({
    teamId: params.teamId,
    sourceType: "manual_adjustment",
    sourceId: params.journalId,
  });

  return rebuildYearEndMutationPack({
    db,
    teamId: params.teamId,
    periodKey: params.periodKey,
  });
}
