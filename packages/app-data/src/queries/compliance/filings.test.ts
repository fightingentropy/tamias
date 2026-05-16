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
  getFilingProfileRecord,
  listComplianceObligationRecords,
  upsertComplianceObligationRecord,
  upsertFilingProfileRecord,
} from "./filings";

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
      "../../../../../api/migrations/d1/0038_filing_profiles_compliance_obligations.sql",
    ),
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

describe("compliance filing state D1", () => {
  test("upserts filing profiles and annual obligations", async () => {
    const { db, close } = createD1();

    try {
      const profile = await upsertFilingProfileRecord(db, {
        id: "profile-1",
        teamId: "team-1",
        provider: "hmrc-vat",
        legalEntityType: "uk_ltd",
        enabled: true,
        countryCode: "GB",
        companyName: "Marlowe Ltd",
        companyNumber: "12345678",
        utr: "1234567890",
        vrn: "123456789",
        vatScheme: "standard_quarterly",
        accountingBasis: "cash",
        filingMode: "client",
        yearEndMonth: 3,
        yearEndDay: 31,
        baseCurrency: "GBP",
        directors: ["Marlowe Walker"],
        dormant: false,
        auditExemptionClaimed: true,
      });

      expect(profile).toMatchObject({
        id: "profile-1",
        teamId: "team-1",
        enabled: true,
        directors: ["Marlowe Walker"],
        dormant: false,
        auditExemptionClaimed: true,
      });

      await upsertFilingProfileRecord(db, {
        ...profile,
        legalEntityType: profile.legalEntityType,
        enabled: false,
        countryCode: profile.countryCode,
        companyName: "Marlowe Group",
        accountingBasis: profile.accountingBasis,
        filingMode: profile.filingMode,
        directors: ["Marlowe Walker", "E. Walker"],
      });

      await expect(
        getFilingProfileRecord(db, {
          teamId: "team-1",
          provider: "hmrc-vat",
        }),
      ).resolves.toMatchObject({
        id: "profile-1",
        enabled: false,
        companyName: "Marlowe Group",
        directors: ["Marlowe Walker", "E. Walker"],
      });

      const obligation = await upsertComplianceObligationRecord(db, {
        id: "obligation-1",
        teamId: "team-1",
        filingProfileId: "profile-1",
        provider: "companies-house",
        obligationType: "accounts",
        periodKey: "2026-03-31",
        periodStart: "2025-04-01",
        periodEnd: "2026-03-31",
        dueDate: "2026-12-31",
        status: "open",
        externalId: "profile-1:accounts:2026-03-31",
        raw: { generatedBy: "test" },
      });

      expect(obligation).toMatchObject({
        id: "obligation-1",
        provider: "companies-house",
        raw: { generatedBy: "test" },
      });

      await upsertComplianceObligationRecord(db, {
        ...obligation,
        status: "overdue",
        dueDate: "2026-11-30",
        raw: null,
      });

      await expect(
        listComplianceObligationRecords(db, {
          teamId: "team-1",
          obligationType: "accounts",
        }),
      ).resolves.toMatchObject([
        {
          id: "obligation-1",
          status: "overdue",
          dueDate: "2026-11-30",
          raw: null,
        },
      ]);
    } finally {
      close();
    }
  });
});
