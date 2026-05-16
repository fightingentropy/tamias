import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import {
  createDatabase,
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
} from "../../client";
import { createInsight, getInsightByPeriod, getInsights, updateInsight } from "./records";
import { getInsightById } from "./shared";
import {
  dismissInsight,
  getInsightsForUser,
  markInsightAsRead,
  undoDismissInsight,
} from "./user-status";

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
    const result = (this.statement as any).run(...this.values);

    return {
      results: [] as T[],
      success: true,
      meta: { changes: result.changes },
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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0028_insights.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    db: createDatabase({ cloudflare: { d1 } }),
    close: () => sqlite.close(),
  };
}

describe("insights D1", () => {
  test("creates, updates, filters, and reads insights", async () => {
    const { db, close } = createD1();

    try {
      const first = await createInsight(db, {
        teamId: "team_1",
        periodType: "weekly",
        periodStart: new Date("2026-01-05T00:00:00.000Z"),
        periodEnd: new Date("2026-01-11T23:59:59.000Z"),
        periodYear: 2026,
        periodNumber: 2,
        currency: "GBP",
      });
      expect(first).not.toBeNull();

      await expect(
        createInsight(db, {
          teamId: "team_1",
          periodType: "weekly",
          periodStart: new Date("2026-01-05T00:00:00.000Z"),
          periodEnd: new Date("2026-01-11T23:59:59.000Z"),
          periodYear: 2026,
          periodNumber: 2,
          currency: "GBP",
        }),
      ).resolves.toBeNull();

      const second = await createInsight(db, {
        teamId: "team_1",
        periodType: "weekly",
        periodStart: new Date("2026-01-12T00:00:00.000Z"),
        periodEnd: new Date("2026-01-18T23:59:59.000Z"),
        periodYear: 2026,
        periodNumber: 3,
        currency: "GBP",
      });
      expect(second).not.toBeNull();

      await expect(
        getInsightById(db, { teamId: "team_1", id: first!.id }),
      ).resolves.toMatchObject({
        id: first!.id,
        status: "pending",
        selectedMetrics: null,
      });

      await updateInsight(db, {
        teamId: "team_1",
        id: second!.id,
        status: "completed",
        title: "Revenue improved",
        selectedMetrics: [
          {
            type: "revenue",
            label: "Revenue",
            value: 1200,
            previousValue: 1000,
            change: 20,
            changeDirection: "up",
          },
        ],
        generatedAt: new Date("2026-01-19T12:00:00.000Z"),
      });

      await expect(
        getInsightByPeriod(db, {
          teamId: "team_1",
          periodType: "weekly",
          periodYear: 2026,
          periodNumber: 3,
        }),
      ).resolves.toMatchObject({
        id: second!.id,
        status: "completed",
        title: "Revenue improved",
        selectedMetrics: [{ type: "revenue", label: "Revenue", value: 1200 }],
      });

      const page = await getInsights(db, { teamId: "team_1", pageSize: 1 });
      expect(page.data.map((insight) => insight.id)).toEqual([second!.id]);
      expect(page.meta.hasNextPage).toBe(true);
    } finally {
      close();
    }
  });

  test("tracks per-user read and dismissed statuses", async () => {
    const { db, close } = createD1();

    try {
      const insight = await createInsight(db, {
        teamId: "team_1",
        periodType: "monthly",
        periodStart: new Date("2026-02-01T00:00:00.000Z"),
        periodEnd: new Date("2026-02-28T23:59:59.000Z"),
        periodYear: 2026,
        periodNumber: 2,
        currency: "GBP",
      });
      expect(insight).not.toBeNull();

      await markInsightAsRead(db, { insightId: insight!.id, userId: "user_1" });
      await dismissInsight(db, { insightId: insight!.id, userId: "user_1" });

      const hidden = await getInsightsForUser(db, {
        teamId: "team_1",
        userId: "user_1",
      });
      expect(hidden.data).toHaveLength(0);

      const withDismissed = await getInsightsForUser(db, {
        teamId: "team_1",
        userId: "user_1",
        includeDismissed: true,
      });
      expect(withDismissed.data[0]?.userStatus.readAt).toBeTruthy();
      expect(withDismissed.data[0]?.userStatus.dismissedAt).toBeTruthy();

      await undoDismissInsight(db, { insightId: insight!.id, userId: "user_1" });

      const visible = await getInsightsForUser(db, {
        teamId: "team_1",
        userId: "user_1",
      });
      expect(visible.data).toHaveLength(1);
      expect(visible.data[0]?.userStatus.dismissedAt).toBeNull();
    } finally {
      close();
    }
  });
});
