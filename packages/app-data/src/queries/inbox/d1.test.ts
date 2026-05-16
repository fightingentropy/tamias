import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import type {
  CloudflareD1DatabaseBinding,
  CloudflareD1PreparedStatementBinding,
} from "../../client";
import {
  getInboxItemByIdFromD1,
  getInboxItemsByAmountRangeFromD1,
  getInboxItemsFromD1,
  getInboxItemsPageFromD1,
  getInboxStatusCountSummaryFromD1,
  getTransactionMatchSuggestionsFromD1,
  searchInboxItemsFromD1,
  upsertInboxItemsInD1,
  upsertTransactionMatchSuggestionsInD1,
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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0041_inbox_items.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    d1,
    close: () => sqlite.close(),
  };
}

describe("inbox items D1", () => {
  test("upserts, searches, pages, counts, and stores match suggestions", async () => {
    const { d1, close } = createD1();

    try {
      const [item] = await upsertInboxItemsInD1(d1, {
        items: [
          {
            id: "inbox-1",
            teamId: "team-1",
            createdAt: "2026-05-15T10:00:00.000Z",
            updatedAt: "2026-05-15T10:00:00.000Z",
            filePath: ["team-1", "receipt.pdf"],
            fileName: "receipt.pdf",
            displayName: "Acme Receipt",
            amount: 42.5,
            currency: "GBP",
            date: "2026-05-15",
            referenceId: "ref-1",
            status: "pending",
            type: "expense",
            meta: { source: "gmail" },
          },
        ],
      });

      expect(item).toMatchObject({
        id: "inbox-1",
        teamId: "team-1",
        filePath: ["team-1", "receipt.pdf"],
        meta: { source: "gmail" },
      });

      await upsertInboxItemsInD1(d1, {
        items: [
          {
            ...item!,
            status: "done",
            transactionId: "txn-1",
            updatedAt: "2026-05-15T11:00:00.000Z",
          },
          {
            id: "inbox-2",
            teamId: "team-1",
            createdAt: "2026-05-15T12:00:00.000Z",
            updatedAt: "2026-05-15T12:00:00.000Z",
            filePath: ["team-1", "invoice.pdf"],
            fileName: "invoice.pdf",
            displayName: "Beta Invoice",
            amount: 125,
            currency: "GBP",
            date: "2026-05-15",
            status: "pending",
            type: "invoice",
          },
        ],
      });

      await expect(
        getInboxItemByIdFromD1(d1, { teamId: "team-1", inboxId: "inbox-1" }),
      ).resolves.toMatchObject({
        status: "done",
        transactionId: "txn-1",
      });
      await expect(getInboxItemsFromD1(d1, { teamId: "team-1", referenceIds: ["ref-1"] }))
        .resolves.toHaveLength(1);
      await expect(searchInboxItemsFromD1(d1, { teamId: "team-1", query: "Beta", limit: 10 }))
        .resolves.toEqual([expect.objectContaining({ id: "inbox-2" })]);
      await expect(searchInboxItemsFromD1(d1, { teamId: "team-1", query: "Acme", limit: 10 }))
        .resolves.toEqual([]);
      await expect(
        getInboxItemsByAmountRangeFromD1(d1, {
          teamId: "team-1",
          minAmount: 12000,
          maxAmount: 13000,
          limit: 10,
        }),
      ).resolves.toEqual([expect.objectContaining({ id: "inbox-2" })]);

      const firstPage = await getInboxItemsPageFromD1(d1, {
        teamId: "team-1",
        pageSize: 1,
        order: "desc",
      });

      expect(firstPage).toMatchObject({
        isDone: false,
        page: [expect.objectContaining({ id: "inbox-2" })],
      });
      await expect(
        getInboxItemsPageFromD1(d1, {
          teamId: "team-1",
          cursor: firstPage.continueCursor,
          pageSize: 1,
          order: "desc",
        }),
      ).resolves.toMatchObject({
        isDone: true,
        page: [expect.objectContaining({ id: "inbox-1" })],
      });
      await expect(
        getInboxStatusCountSummaryFromD1(d1, {
          teamId: "team-1",
          createdAtFrom: "2026-05-15T00:00:00.000Z",
          createdAtTo: "2026-05-15T23:59:59.999Z",
          rangeStatus: "done",
        }),
      ).resolves.toMatchObject({
        totals: expect.objectContaining({ done: 1, pending: 1 }),
        rangeCount: 1,
      });

      const [suggestion] = await upsertTransactionMatchSuggestionsInD1(d1, {
        suggestions: [
          {
            id: "suggestion-1",
            teamId: "team-1",
            inboxId: "inbox-2",
            transactionId: "txn-2",
            confidenceScore: 0.86,
            amountScore: 0.9,
            currencyScore: 1,
            dateScore: 0.8,
            nameScore: 0.7,
            matchType: "high_confidence",
            matchDetails: { source: "test" },
            status: "pending",
          },
        ],
      });

      expect(suggestion).toMatchObject({
        id: "suggestion-1",
        inboxId: "inbox-2",
        transactionId: "txn-2",
        matchDetails: { source: "test" },
      });
      await expect(
        getTransactionMatchSuggestionsFromD1(d1, {
          teamId: "team-1",
          inboxId: "inbox-2",
          statuses: ["pending"],
        }),
      ).resolves.toEqual([expect.objectContaining({ id: "suggestion-1" })]);
    } finally {
      close();
    }
  });
});
