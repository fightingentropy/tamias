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
  deleteCloseCompanyLoansScheduleRecord,
  deleteCorporationTaxAdjustmentRecord,
  deleteCorporationTaxRateScheduleRecord,
  getCloseCompanyLoansScheduleByPeriod,
  getCorporationTaxRateScheduleByPeriod,
  listCorporationTaxAdjustmentsForPeriod,
  upsertCloseCompanyLoansScheduleRecord,
  upsertCorporationTaxAdjustmentRecord,
  upsertCorporationTaxRateScheduleRecord,
} from "./tax-schedules";

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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0034_year_end_tax_schedules.sql"),
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

describe("year-end tax schedules D1", () => {
  test("stores corporation tax adjustments, rate inputs, and close-company loans", async () => {
    const { db, close } = createD1();
    const period = {
      teamId: "team-1",
      filingProfileId: "profile-1",
      periodKey: "2026",
    };

    try {
      const adjustment = await upsertCorporationTaxAdjustmentRecord(db, {
        ...period,
        category: "capital_allowances",
        label: "Annual investment allowance",
        amount: -1200,
        note: "AIA claim",
        createdBy: "user-1",
      });
      await upsertCorporationTaxAdjustmentRecord(db, {
        ...period,
        id: adjustment.id,
        category: "capital_allowances",
        label: "AIA updated",
        amount: -1400,
        note: null,
        createdBy: "user-1",
      });

      await expect(listCorporationTaxAdjustmentsForPeriod(db, period)).resolves.toMatchObject([
        {
          id: adjustment.id,
          amount: -1400,
          label: "AIA updated",
          note: null,
        },
      ]);

      await upsertCorporationTaxRateScheduleRecord(db, {
        ...period,
        exemptDistributions: 250,
        associatedCompaniesThisPeriod: null,
        associatedCompaniesFirstYear: 0,
        associatedCompaniesSecondYear: 1,
        createdBy: "user-1",
      });
      await upsertCorporationTaxRateScheduleRecord(db, {
        ...period,
        exemptDistributions: 300,
        associatedCompaniesThisPeriod: 0,
        associatedCompaniesFirstYear: null,
        associatedCompaniesSecondYear: null,
        createdBy: "user-2",
      });

      await expect(getCorporationTaxRateScheduleByPeriod(db, period)).resolves.toMatchObject({
        teamId: "team-1",
        exemptDistributions: 300,
        associatedCompaniesThisPeriod: 0,
        associatedCompaniesFirstYear: null,
        associatedCompaniesSecondYear: null,
        createdBy: "user-2",
      });

      await upsertCloseCompanyLoansScheduleRecord(db, {
        ...period,
        beforeEndPeriod: true,
        loansMade: [{ name: "Director A", amountOfLoan: 5000 }],
        taxChargeable: 1625,
        reliefEarlierThan: [
          {
            name: "Director A",
            amountRepaid: 1000,
            amountReleasedOrWrittenOff: null,
            date: "2026-07-01",
          },
        ],
        reliefEarlierDue: 325,
        loanLaterReliefNow: [],
        reliefLaterDue: null,
        totalLoansOutstanding: 4000,
        createdBy: "user-1",
      });

      await expect(getCloseCompanyLoansScheduleByPeriod(db, period)).resolves.toMatchObject({
        beforeEndPeriod: true,
        loansMade: [{ name: "Director A", amountOfLoan: 5000 }],
        taxChargeable: 1625,
        reliefEarlierThan: [
          {
            name: "Director A",
            amountRepaid: 1000,
            amountReleasedOrWrittenOff: null,
            date: "2026-07-01",
          },
        ],
        reliefEarlierDue: 325,
        totalLoansOutstanding: 4000,
      });

      await expect(
        deleteCorporationTaxAdjustmentRecord(db, {
          teamId: "team-1",
          id: adjustment.id,
        }),
      ).resolves.toEqual({ deleted: true });
      await expect(deleteCorporationTaxRateScheduleRecord(db, period)).resolves.toEqual({
        deleted: true,
      });
      await expect(deleteCloseCompanyLoansScheduleRecord(db, period)).resolves.toEqual({
        deleted: true,
      });
      await expect(listCorporationTaxAdjustmentsForPeriod(db, period)).resolves.toEqual([]);
      await expect(getCorporationTaxRateScheduleByPeriod(db, period)).resolves.toBeNull();
      await expect(getCloseCompanyLoansScheduleByPeriod(db, period)).resolves.toBeNull();
    } finally {
      close();
    }
  });
});
