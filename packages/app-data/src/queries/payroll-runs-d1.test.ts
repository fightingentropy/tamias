import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import {
  createDatabase,
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
} from "../client";
import {
  getPayrollRunByPeriodFromD1,
  listPayrollRunsFromD1,
  requirePayrollRunsD1,
  upsertPayrollRunInD1,
} from "./payroll-runs-d1";

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
    resolve(import.meta.dir, "../../../../api/migrations/d1/0029_payroll_runs.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    d1,
    close: () => sqlite.close(),
  };
}

describe("payroll runs D1", () => {
  test("requires a Cloudflare D1-backed database context", () => {
    expect(() => requirePayrollRunsD1(createDatabase())).toThrow(
      "Payroll runs require Cloudflare D1",
    );
  });

  test("upserts by team and period while preserving the run id", async () => {
    const { d1, close } = createD1();

    try {
      const inserted = await upsertPayrollRunInD1(d1, {
        id: "run-1",
        teamId: "team-1",
        filingProfileId: "profile-1",
        periodKey: "2026-04-01:2026-04-30",
        payPeriodStart: "2026-04-01",
        payPeriodEnd: "2026-04-30",
        runDate: "2026-05-01",
        source: "csv",
        status: "imported",
        checksum: "checksum-1",
        currency: "GBP",
        journalEntryId: "run-1",
        lineCount: 3,
        liabilityTotals: {
          grossPay: 2500,
          employerTaxes: 120,
          payeLiability: 650,
        },
        exportBundles: [],
        latestExportedAt: null,
        meta: { importedBy: "user-1" },
        createdBy: "user-1",
      });

      expect(inserted.id).toBe("run-1");
      expect(inserted.meta).toEqual({ importedBy: "user-1" });

      const updated = await upsertPayrollRunInD1(d1, {
        id: "ignored-new-id",
        teamId: "team-1",
        filingProfileId: "profile-1",
        periodKey: "2026-04-01:2026-04-30",
        payPeriodStart: "2026-04-01",
        payPeriodEnd: "2026-04-30",
        runDate: "2026-05-02",
        source: "manual",
        status: "exported",
        checksum: "checksum-2",
        currency: "GBP",
        journalEntryId: "run-1",
        lineCount: 4,
        liabilityTotals: {
          grossPay: 3000,
          employerTaxes: 180,
          payeLiability: 780,
        },
        exportBundles: [
          {
            id: "bundle-1",
            filePath: "team-1/compliance/payroll/export.zip",
            fileName: "export.zip",
            checksum: "bundle-checksum",
            generatedAt: "2026-05-03T10:00:00.000Z",
            manifest: { files: [{ name: "payroll-runs.csv" }] },
          },
        ],
        latestExportedAt: "2026-05-03T10:00:00.000Z",
        meta: { importedBy: "user-2" },
        createdBy: "user-2",
      });

      expect(updated.id).toBe("run-1");
      expect(updated.createdAt).toBe(inserted.createdAt);
      expect(updated.status).toBe("exported");
      expect(updated.exportBundles).toHaveLength(1);
      expect(updated.liabilityTotals.payeLiability).toBe(780);

      await upsertPayrollRunInD1(d1, {
        id: "run-2",
        teamId: "team-1",
        filingProfileId: "profile-1",
        periodKey: "2026-05-01:2026-05-31",
        payPeriodStart: "2026-05-01",
        payPeriodEnd: "2026-05-31",
        runDate: "2026-06-01",
        source: "csv",
        status: "imported",
        checksum: "checksum-3",
        currency: "GBP",
        journalEntryId: "run-2",
        lineCount: 3,
        liabilityTotals: {
          grossPay: 2000,
          employerTaxes: 100,
          payeLiability: 500,
        },
        exportBundles: [],
        latestExportedAt: null,
        meta: null,
        createdBy: null,
      });

      const listed = await listPayrollRunsFromD1(d1, {
        teamId: "team-1",
      });
      const byPeriod = await getPayrollRunByPeriodFromD1(d1, {
        teamId: "team-1",
        periodKey: "2026-04-01:2026-04-30",
      });

      expect(listed.map((run) => run.id)).toEqual(["run-2", "run-1"]);
      expect(byPeriod?.id).toBe("run-1");
      expect(
        await getPayrollRunByPeriodFromD1(d1, {
          teamId: "team-2",
          periodKey: "2026-04-01:2026-04-30",
        }),
      ).toBeNull();
    } finally {
      close();
    }
  });
});
