import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import {
  createDatabase,
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
} from "../../client";
import {
  countSourceLinksBySourceTypes,
  deleteComplianceJournalEntriesForSourceTypesInD1,
  deleteComplianceJournalEntryBySource,
  listComplianceJournalEntries,
  requireComplianceLedgerD1,
  upsertComplianceJournalEntry,
} from "./ledger";

class SqliteD1Statement implements CloudflareD1PreparedStatementBinding {
  constructor(
    private readonly statement: ReturnType<SqliteDatabase["prepare"]>,
    private readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new SqliteD1Statement(this.statement, values);
  }

  async first<T = unknown>(columnName?: string) {
    const row = (this.statement as any).get(...this.values) as Record<string, unknown> | null;

    if (columnName) {
      return (row?.[columnName] ?? null) as T | null;
    }

    return row as T | null;
  }

  async all<T = unknown>() {
    return {
      results: (this.statement as any).all(...this.values) as T[],
      success: true,
    };
  }

  async run<T = unknown>() {
    (this.statement as any).run(...this.values);

    return {
      results: [] as T[],
      success: true,
    };
  }

  async raw<T = unknown[]>() {
    return (this.statement as any).values(...this.values) as T[];
  }
}

class SqliteD1Database implements CloudflareD1DatabaseBinding {
  constructor(private readonly db: SqliteDatabase) {}

  prepare(query: string) {
    return new SqliteD1Statement(this.db.prepare(query));
  }

  async batch<T = unknown>(statements: CloudflareD1PreparedStatementBinding[]) {
    const results = [];

    for (const statement of statements) {
      results.push(await statement.run<T>());
    }

    return results;
  }

  async exec(query: string) {
    this.db.exec(query);

    return {
      count: 0,
      duration: 0,
    };
  }
}

function createD1() {
  const sqlite = new SqliteDatabase(":memory:");
  const d1 = new SqliteD1Database(sqlite);
  const migration = readFileSync(
    resolve(
      import.meta.dir,
      "../../../../../api/migrations/d1/0030_compliance_ledger_source_links.sql",
    ),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    db: createDatabase({ cloudflare: { d1 } }),
    d1,
    close: () => sqlite.close(),
  };
}

describe("compliance ledger D1", () => {
  test("requires a Cloudflare D1-backed database context", () => {
    expect(() => requireComplianceLedgerD1(createDatabase())).toThrow(
      "Compliance ledger requires Cloudflare D1",
    );
  });

  test("upserts, lists, counts source links, and deletes journal entries", async () => {
    const { db, close } = createD1();

    try {
      const inserted = await upsertComplianceJournalEntry(db, {
        teamId: "team-1",
        entry: {
          journalEntryId: "journal-1",
          entryDate: "2026-04-30",
          reference: "MJ-1",
          description: "Opening adjustment",
          sourceType: "manual_adjustment",
          sourceId: "manual-1",
          currency: "GBP",
          meta: { periodKey: "2026" },
          lines: [
            { accountCode: "1000", debit: 100, credit: 0 },
            { accountCode: "3100", debit: 0, credit: 100 },
          ],
        },
      });

      expect(inserted).toEqual({ journalEntryId: "journal-1", updated: false });
      await expect(
        countSourceLinksBySourceTypes(db, {
          teamId: "team-1",
          sourceTypes: ["manual_adjustment", "payroll_import"],
        }),
      ).resolves.toBe(1);

      await expect(
        listComplianceJournalEntries(db, {
          teamId: "team-1",
          sourceTypes: ["manual_adjustment"],
        }),
      ).resolves.toMatchObject([
        {
          journalEntryId: "journal-1",
          entryDate: "2026-04-30",
          reference: "MJ-1",
          sourceType: "manual_adjustment",
          sourceId: "manual-1",
          meta: { periodKey: "2026" },
          lines: [
            { accountCode: "1000", debit: 100, credit: 0 },
            { accountCode: "3100", debit: 0, credit: 100 },
          ],
        },
      ]);

      const updated = await upsertComplianceJournalEntry(db, {
        teamId: "team-1",
        entry: {
          journalEntryId: "journal-1",
          entryDate: "2026-05-01",
          reference: "MJ-1A",
          description: "Opening adjustment updated",
          sourceType: "manual_adjustment",
          sourceId: "manual-1",
          currency: "GBP",
          meta: null,
          lines: [
            { accountCode: "1000", debit: 120, credit: 0 },
            { accountCode: "3100", debit: 0, credit: 120 },
          ],
        },
      });

      expect(updated).toEqual({ journalEntryId: "journal-1", updated: true });
      await expect(listComplianceJournalEntries(db, { teamId: "team-1" })).resolves.toMatchObject([
        {
          journalEntryId: "journal-1",
          entryDate: "2026-05-01",
          reference: "MJ-1A",
          meta: null,
          lines: [
            { accountCode: "1000", debit: 120, credit: 0 },
            { accountCode: "3100", debit: 0, credit: 120 },
          ],
        },
      ]);

      await expect(
        deleteComplianceJournalEntryBySource(db, {
          teamId: "team-1",
          sourceType: "manual_adjustment",
          sourceId: "manual-1",
        }),
      ).resolves.toEqual({ deleted: true, journalEntryId: "journal-1" });
      await expect(listComplianceJournalEntries(db, { teamId: "team-1" })).resolves.toEqual([]);
      await expect(
        countSourceLinksBySourceTypes(db, {
          teamId: "team-1",
          sourceTypes: ["manual_adjustment"],
        }),
      ).resolves.toBe(0);
    } finally {
      close();
    }
  });

  test("deletes derived entries by source type", async () => {
    const { db, d1, close } = createD1();

    try {
      await upsertComplianceJournalEntry(db, {
        teamId: "team-1",
        entry: {
          journalEntryId: "txn-1",
          entryDate: "2026-04-01",
          sourceType: "transaction",
          sourceId: "txn-1",
          currency: "GBP",
          lines: [
            { accountCode: "1000", debit: 50, credit: 0 },
            { accountCode: "4000", debit: 0, credit: 50 },
          ],
        },
      });
      await upsertComplianceJournalEntry(db, {
        teamId: "team-1",
        entry: {
          journalEntryId: "payroll-1",
          entryDate: "2026-04-30",
          sourceType: "payroll_import",
          sourceId: "payroll-1",
          currency: "GBP",
          lines: [
            { accountCode: "6100", debit: 50, credit: 0 },
            { accountCode: "2210", debit: 0, credit: 50 },
          ],
        },
      });

      await deleteComplianceJournalEntriesForSourceTypesInD1(d1, {
        teamId: "team-1",
        sourceTypes: ["transaction"],
      });

      await expect(listComplianceJournalEntries(db, { teamId: "team-1" })).resolves.toMatchObject([
        {
          journalEntryId: "payroll-1",
          sourceType: "payroll_import",
        },
      ]);
    } finally {
      close();
    }
  });
});
