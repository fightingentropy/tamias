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
  deleteAccountingSyncRecordsForTransactions,
  getAccountingSyncStatus,
  getSyncedTransactionIds,
  updateSyncedAttachmentMapping,
  upsertAccountingSyncRecord,
} from "./records";

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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0032_accounting_sync_records.sql"),
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

describe("accounting sync D1", () => {
  test("upserts, lists, updates, and deletes sync records", async () => {
    const { db, close } = createD1();

    try {
      const created = await upsertAccountingSyncRecord(db, {
        teamId: "team-1",
        transactionId: "transaction-1",
        provider: "quickbooks",
        providerTenantId: "tenant-1",
        providerTransactionId: "provider-transaction-1",
        syncedAttachmentMapping: {
          "attachment-1": "provider-attachment-1",
        },
        status: "synced",
        providerEntityType: "Purchase",
      });

      expect(created).toMatchObject({
        teamId: "team-1",
        transactionId: "transaction-1",
        provider: "quickbooks",
        providerTenantId: "tenant-1",
        providerTransactionId: "provider-transaction-1",
        syncedAttachmentMapping: {
          "attachment-1": "provider-attachment-1",
        },
        status: "synced",
        providerEntityType: "Purchase",
        errorMessage: null,
        errorCode: null,
      });

      const failed = await upsertAccountingSyncRecord(db, {
        teamId: "team-1",
        transactionId: "transaction-2",
        provider: "quickbooks",
        providerTenantId: "tenant-1",
        status: "failed",
        errorMessage: "Provider rejected transaction",
        errorCode: "BAD_TXN",
      });
      expect(failed.errorMessage).toBe("Provider rejected transaction");

      const listed = await getAccountingSyncStatus(db, {
        teamId: "team-1",
        provider: "quickbooks",
      });
      expect(listed.map((record) => record.transactionId).sort()).toEqual([
        "transaction-1",
        "transaction-2",
      ]);

      const syncedIds = await getSyncedTransactionIds(db, {
        teamId: "team-1",
        provider: "quickbooks",
      });
      expect(syncedIds).toEqual(["transaction-1"]);

      const updated = await updateSyncedAttachmentMapping(db, {
        syncRecordId: created.id,
        syncedAttachmentMapping: {
          "attachment-1": "provider-attachment-1",
          "attachment-2": null,
        },
        status: "partial",
        errorMessage: "One attachment failed",
      });
      expect(updated).toMatchObject({
        id: created.id,
        status: "partial",
        errorMessage: "One attachment failed",
        syncedAttachmentMapping: {
          "attachment-1": "provider-attachment-1",
          "attachment-2": null,
        },
      });

      const corrected = await upsertAccountingSyncRecord(db, {
        teamId: "team-1",
        transactionId: "transaction-2",
        provider: "quickbooks",
        providerTenantId: "tenant-1",
        providerTransactionId: "provider-transaction-2",
        status: "synced",
      });
      expect(corrected.id).toBe(failed.id);
      expect(corrected.errorMessage).toBeNull();
      expect(corrected.errorCode).toBeNull();

      const deleted = await deleteAccountingSyncRecordsForTransactions(db, {
        teamId: "team-1",
        transactionIds: ["transaction-1", "transaction-2"],
        provider: "quickbooks",
      });
      expect(deleted).toEqual({ count: 2 });

      await expect(
        getAccountingSyncStatus(db, {
          teamId: "team-1",
          provider: "quickbooks",
        }),
      ).resolves.toEqual([]);
    } finally {
      close();
    }
  });
});
