import {
  listComplianceJournalEntriesFromConvex,
  type ComplianceJournalEntryRecord,
} from "../../convex";
import type { Database } from "../../client";

type DerivedJournalEntry = ComplianceJournalEntryRecord;

const DERIVED_LEDGER_SOURCE_TYPES = [
  "transaction",
  "invoice",
  "invoice_refund",
] as const;

export function listJournalRowsForPeriod(
  entries: DerivedJournalEntry[],
  periodStart: string,
  periodEnd: string,
) {
  return entries
    .filter(
      (entry) => entry.entryDate >= periodStart && entry.entryDate <= periodEnd,
    )
    .flatMap((entry) =>
      entry.lines.map((line) => ({
        sourceType: entry.sourceType,
        accountCode: line.accountCode,
        debit: line.debit ?? 0,
        credit: line.credit ?? 0,
      })),
    );
}

export async function listDerivedLedgerEntries(
  db: Database,
  params: {
    teamId: string;
  },
) {
  void db;

  return listComplianceJournalEntriesFromConvex({
    teamId: params.teamId,
    sourceTypes: [...DERIVED_LEDGER_SOURCE_TYPES],
  });
}
