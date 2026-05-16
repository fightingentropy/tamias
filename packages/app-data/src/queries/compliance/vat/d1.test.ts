import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import {
  createDatabase,
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
} from "../../../client";
import { upsertComplianceJournalEntry } from "../ledger";
import { getVatDraft } from "./draft";
import {
  createComplianceAdjustmentInD1,
  getEvidencePackByIdFromD1,
  listVatObligationsFromD1,
  listVatSubmissionsFromD1,
  markVatReturnAcceptedInD1,
  requireVatFilingStateD1,
  upsertEvidencePackInD1,
  upsertVatObligationInD1,
  upsertVatReturnInD1,
} from "./d1";

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

function readMigration(fileName: string) {
  return readFileSync(
    resolve(import.meta.dir, "../../../../../../api/migrations/d1", fileName),
    "utf8",
  );
}

function createD1() {
  const sqlite = new SqliteDatabase(":memory:");
  const d1 = new SqliteD1Database(sqlite);

  sqlite.exec(readMigration("0030_compliance_ledger_source_links.sql"));
  sqlite.exec(readMigration("0035_vat_filing_state.sql"));

  return {
    db: createDatabase({ cloudflare: { d1 } }),
    close: () => sqlite.close(),
  };
}

describe("VAT filing state D1", () => {
  test("requires a Cloudflare D1-backed database context", () => {
    expect(() => requireVatFilingStateD1(createDatabase())).toThrow(
      "VAT filing state requires Cloudflare D1",
    );
  });

  test("stores VAT obligations, returns, adjustments, and draft counts in D1", async () => {
    const { db, close } = createD1();

    try {
      const obligation = await upsertVatObligationInD1(db, {
        id: "obl-1",
        teamId: "team-1",
        filingProfileId: "profile-1",
        provider: "hmrc-vat",
        obligationType: "vat",
        periodKey: "26A1",
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        dueDate: "2026-05-07",
        status: "open",
        externalId: "26A1",
        raw: { source: "hmrc" },
      });

      expect(obligation).toMatchObject({
        id: "obl-1",
        teamId: "team-1",
        periodKey: "26A1",
        raw: { source: "hmrc" },
      });
      await expect(listVatObligationsFromD1(db, { teamId: "team-1" })).resolves.toHaveLength(1);

      const createdReturn = await upsertVatReturnInD1(db, {
        id: "return-1",
        teamId: "team-1",
        filingProfileId: "profile-1",
        obligationId: obligation.id,
        periodKey: "26A1",
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        status: "ready",
        currency: "GBP",
        netVatDue: 125,
        lines: [
          { code: "box1", label: "VAT due on sales", amount: 150 },
          { code: "box4", label: "VAT reclaimed", amount: 25 },
          { code: "box5", label: "Net VAT due", amount: 125 },
        ],
      });

      const updatedReturn = await upsertVatReturnInD1(db, {
        teamId: "team-1",
        filingProfileId: "profile-1",
        obligationId: obligation.id,
        periodKey: "26A1",
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        status: "ready",
        currency: "GBP",
        netVatDue: 130,
        lines: [
          { code: "box1", label: "VAT due on sales", amount: 155 },
          { code: "box4", label: "VAT reclaimed", amount: 25 },
          { code: "box5", label: "Net VAT due", amount: 130 },
        ],
      });

      expect(updatedReturn.id).toBe(createdReturn.id);
      expect(updatedReturn.netVatDue).toBe(130);

      await createComplianceAdjustmentInD1(db, {
        id: "adj-1",
        teamId: "team-1",
        filingProfileId: "profile-1",
        vatReturnId: createdReturn.id,
        obligationId: obligation.id,
        effectiveDate: "2026-03-31",
        lineCode: "box1",
        amount: 5,
        reason: "Late sales correction",
        note: "Seed adjustment",
        createdBy: "user-1",
        meta: { source: "test" },
      });
      await upsertComplianceJournalEntry(db, {
        teamId: "team-1",
        entry: {
          journalEntryId: "invoice-1",
          entryDate: "2026-03-01",
          sourceType: "invoice",
          sourceId: "invoice-1",
          currency: "GBP",
          lines: [{ accountCode: "4000", credit: 100 }],
        },
      });
      await upsertComplianceJournalEntry(db, {
        teamId: "team-1",
        entry: {
          journalEntryId: "transaction-1",
          entryDate: "2026-03-02",
          sourceType: "transaction",
          sourceId: "transaction-1",
          currency: "GBP",
          lines: [{ accountCode: "1200", debit: 25 }],
        },
      });

      await expect(
        getVatDraft(db, { teamId: "team-1", vatReturnId: createdReturn.id }),
      ).resolves.toMatchObject({
        id: "return-1",
        netVatDue: 130,
        salesCount: 2,
        purchaseCount: 1,
        adjustmentCount: 1,
      });
    } finally {
      close();
    }
  });

  test("marks accepted returns and stores evidence packs in D1", async () => {
    const { db, close } = createD1();

    try {
      await upsertVatReturnInD1(db, {
        id: "return-1",
        teamId: "team-1",
        filingProfileId: "profile-1",
        obligationId: null,
        periodKey: "26A1",
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        status: "ready",
        currency: "GBP",
        netVatDue: 125,
        lines: [{ code: "box5", label: "Net VAT due", amount: 125 }],
      });

      await expect(
        markVatReturnAcceptedInD1(db, {
          vatReturnId: "return-1",
          submittedAt: "2026-04-10T12:00:00.000Z",
          externalSubmissionId: "bundle-1",
        }),
      ).resolves.toMatchObject({
        id: "return-1",
        status: "accepted",
        submittedAt: "2026-04-10T12:00:00.000Z",
        externalSubmissionId: "bundle-1",
        declarationAccepted: true,
      });
      await expect(listVatSubmissionsFromD1(db, { teamId: "team-1" })).resolves.toMatchObject([
        {
          id: "return-1",
          status: "accepted",
        },
      ]);

      const pack = await upsertEvidencePackInD1(db, {
        id: "pack-1",
        teamId: "team-1",
        filingProfileId: "profile-1",
        vatReturnId: "return-1",
        checksum: "checksum-1",
        payload: { receipt: "bundle-1" },
        createdBy: "user-1",
      });
      const updatedPack = await upsertEvidencePackInD1(db, {
        teamId: "team-1",
        filingProfileId: "profile-1",
        vatReturnId: "return-1",
        checksum: "checksum-2",
        payload: { receipt: "bundle-1", updated: true },
        createdBy: "user-2",
      });

      expect(updatedPack.id).toBe(pack.id);
      await expect(
        getEvidencePackByIdFromD1(db, { teamId: "team-1", id: "pack-1" }),
      ).resolves.toMatchObject({
        id: "pack-1",
        checksum: "checksum-2",
        payload: { receipt: "bundle-1", updated: true },
        createdBy: "user-2",
      });
    } finally {
      close();
    }
  });
});
