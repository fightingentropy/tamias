import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import type {
  CloudflareD1DatabaseBinding,
  CloudflareD1PreparedStatementBinding,
} from "../../client";
import {
  createTransactionAttachmentsInD1,
  deleteTransactionAttachmentsByIdsFromD1,
  deleteTransactionAttachmentsByPathKeysFromD1,
  getTransactionAttachmentFromD1,
  getTransactionAttachmentsByIdsFromD1,
  getTransactionAttachmentsByPathKeysFromD1,
  getTransactionAttachmentsForTransactionIdsFromD1,
  transactionHasAttachmentsInD1,
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

function createD1() {
  const sqlite = new SqliteDatabase(":memory:");
  const d1 = new SqliteD1Database(sqlite);
  const migration = readFileSync(
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0039_transaction_attachments.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    d1,
    close: () => sqlite.close(),
  };
}

describe("transaction attachments D1", () => {
  test("creates, updates, lists, and deletes transaction attachments", async () => {
    const { d1, close } = createD1();

    try {
      const created = await createTransactionAttachmentsInD1(d1, {
        teamId: "team-1",
        attachments: [
          {
            publicTransactionAttachmentId: "att-1",
            transactionId: "tx-1",
            type: "application/pdf",
            name: "receipt.pdf",
            size: 123,
            path: ["vault", "receipt.pdf"],
          },
          {
            publicTransactionAttachmentId: "att-2",
            transactionId: "tx-2",
            type: "image/png",
            name: "receipt.png",
            size: 456,
            path: ["vault", "receipt.png"],
          },
        ],
      });

      expect(created.attachments.map((attachment) => attachment.id)).toEqual(["att-1", "att-2"]);
      expect(created.affectedTransactionIds.sort()).toEqual(["tx-1", "tx-2"]);

      await expect(
        getTransactionAttachmentFromD1(d1, {
          teamId: "team-1",
          transactionId: "tx-1",
          attachmentId: "att-1",
        }),
      ).resolves.toMatchObject({
        id: "att-1",
        teamId: "team-1",
        transactionId: "tx-1",
        path: ["vault", "receipt.pdf"],
      });

      await expect(
        getTransactionAttachmentFromD1(d1, {
          teamId: "team-1",
          transactionId: "tx-2",
          attachmentId: "att-1",
        }),
      ).resolves.toBeNull();

      await expect(
        getTransactionAttachmentsByIdsFromD1(d1, {
          teamId: "team-1",
          attachmentIds: ["att-2", "att-1", "att-1"],
        }).then((rows) => rows.map((row) => row.id)),
      ).resolves.toEqual(["att-1", "att-2"]);

      await expect(
        getTransactionAttachmentsForTransactionIdsFromD1(d1, {
          teamId: "team-1",
          transactionIds: ["tx-1"],
        }).then((rows) => rows.map((row) => row.id)),
      ).resolves.toEqual(["att-1"]);

      await expect(
        getTransactionAttachmentsByPathKeysFromD1(d1, {
          teamId: "team-1",
          pathKeys: [["vault", "receipt.pdf"]],
        }).then((rows) => rows.map((row) => row.id)),
      ).resolves.toEqual(["att-1"]);

      const updated = await createTransactionAttachmentsInD1(d1, {
        teamId: "team-1",
        attachments: [
          {
            publicTransactionAttachmentId: "att-1",
            transactionId: "tx-2",
            type: "application/pdf",
            name: "receipt-updated.pdf",
            size: 789,
            path: ["vault", "receipt-updated.pdf"],
          },
        ],
      });

      expect(updated.attachments[0]).toMatchObject({
        id: "att-1",
        transactionId: "tx-2",
        name: "receipt-updated.pdf",
        size: 789,
        path: ["vault", "receipt-updated.pdf"],
      });
      expect(updated.affectedTransactionIds.sort()).toEqual(["tx-1", "tx-2"]);
      await expect(
        transactionHasAttachmentsInD1(d1, {
          teamId: "team-1",
          transactionId: "tx-1",
        }),
      ).resolves.toBe(false);
      await expect(
        transactionHasAttachmentsInD1(d1, {
          teamId: "team-1",
          transactionId: "tx-2",
        }),
      ).resolves.toBe(true);

      const deletedById = await deleteTransactionAttachmentsByIdsFromD1(d1, {
        teamId: "team-1",
        attachmentIds: ["att-2"],
      });
      expect(deletedById).toMatchObject({
        deletedIds: ["att-2"],
        count: 1,
        affectedTransactionIds: ["tx-2"],
      });

      const deletedByPath = await deleteTransactionAttachmentsByPathKeysFromD1(d1, {
        teamId: "team-1",
        pathKeys: [["vault", "receipt-updated.pdf"]],
      });
      expect(deletedByPath).toMatchObject({
        deletedIds: ["att-1"],
        count: 1,
        affectedTransactionIds: ["tx-2"],
      });
      await expect(
        getTransactionAttachmentsForTransactionIdsFromD1(d1, {
          teamId: "team-1",
          transactionIds: ["tx-2"],
        }),
      ).resolves.toEqual([]);
    } finally {
      close();
    }
  });
});
