import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import type {
  CloudflareD1DatabaseBinding,
  CloudflareD1PreparedStatementBinding,
} from "../../client";
import { findRecentActivityFromD1, getActivitiesFromD1, upsertActivityInD1 } from "./d1";

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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0016_activities.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    d1,
    close: () => sqlite.close(),
  };
}

describe("activities D1", () => {
  test("lists with offset cursors and preserves metadata-update ordering", async () => {
    const { d1, close } = createD1();

    try {
      await upsertActivityInD1(d1, {
        id: "activity-1",
        createdAt: "2026-05-15T10:00:00.000Z",
        teamId: "team-1",
        userId: "user-1",
        type: "inbox_new",
        priority: 5,
        groupId: "group-1",
        source: "system",
        metadata: { count: 1 },
        status: "unread",
        lastUsedAt: null,
      });
      await upsertActivityInD1(d1, {
        id: "activity-2",
        createdAt: "2026-05-15T10:01:00.000Z",
        teamId: "team-1",
        userId: "user-1",
        type: "invoice_paid",
        priority: 7,
        groupId: null,
        source: "user",
        metadata: { invoiceId: "invoice-1" },
        status: "read",
        lastUsedAt: null,
      });
      await upsertActivityInD1(d1, {
        id: "activity-3",
        createdAt: "2026-05-15T10:02:00.000Z",
        teamId: "team-1",
        userId: null,
        type: "transaction_category_created",
        priority: 7,
        groupId: null,
        source: "user",
        metadata: { categoryId: "category-1" },
        status: "unread",
        lastUsedAt: null,
      });

      const firstPage = await getActivitiesFromD1(d1, {
        teamId: "team-1",
        pageSize: 2,
      });

      expect(firstPage.data.map((activity) => activity.id)).toEqual(["activity-3", "activity-2"]);
      expect(firstPage.meta).toEqual({
        cursor: "2",
        hasPreviousPage: false,
        hasNextPage: true,
      });

      const secondPage = await getActivitiesFromD1(d1, {
        teamId: "team-1",
        cursor: firstPage.meta.cursor,
        pageSize: 2,
      });

      expect(secondPage.data.map((activity) => activity.id)).toEqual(["activity-1"]);
      expect(secondPage.meta).toEqual({
        cursor: null,
        hasPreviousPage: true,
        hasNextPage: false,
      });

      await upsertActivityInD1(
        d1,
        {
          id: "activity-2",
          createdAt: "2026-05-15T10:03:00.000Z",
          teamId: "team-1",
          userId: "user-1",
          type: "invoice_paid",
          priority: 7,
          groupId: null,
          source: "user",
          metadata: { invoiceId: "invoice-1", refreshed: true },
          status: "read",
          lastUsedAt: null,
        },
        { updatedAt: "2026-05-15T10:03:00.000Z" },
      );

      const reordered = await getActivitiesFromD1(d1, {
        teamId: "team-1",
        pageSize: 3,
      });

      expect(reordered.data.map((activity) => activity.id)).toEqual([
        "activity-2",
        "activity-3",
        "activity-1",
      ]);
      expect(reordered.data[0]?.metadata).toEqual({
        invoiceId: "invoice-1",
        refreshed: true,
      });
    } finally {
      close();
    }
  });

  test("finds recent unread activity by team, user, type, and time window", async () => {
    const { d1, close } = createD1();

    try {
      await upsertActivityInD1(d1, {
        id: "old-activity",
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        teamId: "team-1",
        userId: "user-1",
        type: "inbox_new",
        priority: 5,
        groupId: null,
        source: "system",
        metadata: {},
        status: "unread",
        lastUsedAt: null,
      });
      await upsertActivityInD1(d1, {
        id: "recent-activity",
        createdAt: new Date(Date.now() - 60 * 1000).toISOString(),
        teamId: "team-1",
        userId: "user-1",
        type: "inbox_new",
        priority: 5,
        groupId: null,
        source: "system",
        metadata: {},
        status: "unread",
        lastUsedAt: null,
      });

      const result = await findRecentActivityFromD1(d1, {
        teamId: "team-1",
        userId: "user-1",
        type: "inbox_new",
        timeWindowMinutes: 5,
      });

      expect(result?.id).toBe("recent-activity");
    } finally {
      close();
    }
  });
});
