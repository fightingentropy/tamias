import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import {
  createDatabase,
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
} from "../../client";
import { getYearEndPackByPeriod, upsertYearEndPack } from "./pack-store";

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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0036_year_end_packs.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    db: createDatabase({
      cloudflare: { d1 },
    }),
    close: () => sqlite.close(),
  };
}

describe("year-end pack D1", () => {
  test("upserts and reads the pack snapshot", async () => {
    const { db, close } = createD1();
    const period = {
      teamId: "team-1",
      filingProfileId: "profile-1",
      periodKey: "2026",
    };

    try {
      const created = await upsertYearEndPack(db, {
        ...period,
        periodStart: "2025-04-01",
        periodEnd: "2026-03-31",
        accountsDueDate: "2026-12-31",
        corporationTaxDueDate: "2027-01-01",
        status: "ready",
        currency: "GBP",
        trialBalance: [{ accountCode: "4000", balance: -1000 }],
        profitAndLoss: [{ key: "revenue", amount: 1000 }],
        balanceSheet: [{ key: "assets", amount: 1000 }],
        retainedEarnings: { closingBalance: 1000 },
        workingPapers: [{ key: "bank", total: 1000, lines: [] }],
        corporationTax: { estimatedCorporationTaxDue: 190 },
        manualJournalCount: 2,
        payrollRunCount: 1,
        exportBundles: [],
        latestExportedAt: null,
        snapshotChecksum: "checksum-1",
      });

      expect(created).toMatchObject({
        teamId: "team-1",
        filingProfileId: "profile-1",
        periodKey: "2026",
        status: "ready",
        currency: "GBP",
        manualJournalCount: 2,
        payrollRunCount: 1,
        snapshotChecksum: "checksum-1",
      });

      const updated = await upsertYearEndPack(db, {
        ...created,
        status: "exported",
        exportBundles: [
          {
            id: "bundle-1",
            filePath: "team-1/year-end.zip",
            fileName: "year-end.zip",
            checksum: "bundle-checksum",
            generatedAt: "2026-05-15T12:00:00.000Z",
            manifest: { fileCount: 1 },
          },
        ],
        latestExportedAt: "2026-05-15T12:00:00.000Z",
        snapshotChecksum: "checksum-2",
      });

      expect(updated.id).toBe(created.id);
      await expect(getYearEndPackByPeriod(db, period)).resolves.toMatchObject({
        id: created.id,
        status: "exported",
        exportBundles: [
          {
            id: "bundle-1",
            manifest: { fileCount: 1 },
          },
        ],
        latestExportedAt: "2026-05-15T12:00:00.000Z",
        snapshotChecksum: "checksum-2",
      });
    } finally {
      close();
    }
  });
});
