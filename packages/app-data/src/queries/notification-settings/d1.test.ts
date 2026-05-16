import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { createDatabase } from "../../client";
import type {
  CloudflareD1DatabaseBinding,
  CloudflareD1PreparedStatementBinding,
} from "../../client";
import { getNotificationSettings } from "./reads";
import { bulkUpdateNotificationSettings, upsertNotificationSetting } from "./writes";

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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0009_notification_settings.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    d1,
    close: () => sqlite.close(),
  };
}

describe("notification settings D1 writes", () => {
  test("upserts single and bulk settings in D1", async () => {
    const { d1, close } = createD1();
    const db = createDatabase({
      cloudflare: { d1 },
    });
    const userId = "user-1" as never;

    try {
      const inserted = await upsertNotificationSetting(db, {
        userId,
        teamId: "team-1",
        notificationType: "invoice_paid",
        channel: "email",
        enabled: false,
      });

      expect(inserted).toMatchObject({
        userId,
        teamId: "team-1",
        notificationType: "invoice_paid",
        channel: "email",
        enabled: false,
      });

      const updated = await upsertNotificationSetting(db, {
        userId,
        teamId: "team-1",
        notificationType: "invoice_paid",
        channel: "email",
        enabled: true,
      });

      expect(updated.id).toBe(inserted.id);
      expect(updated.createdAt).toBe(inserted.createdAt);
      expect(updated.enabled).toBe(true);

      const bulk = await bulkUpdateNotificationSettings(db, userId, "team-1", [
        {
          notificationType: "invoice_paid",
          channel: "in_app",
          enabled: false,
        },
        {
          notificationType: "inbox_new",
          channel: "email",
          enabled: false,
        },
      ]);

      expect(bulk).toHaveLength(2);

      const settings = await getNotificationSettings(db, {
        userId,
        teamId: "team-1",
      });

      expect(settings.map((setting) => `${setting.notificationType}:${setting.channel}`)).toEqual([
        "inbox_new:email",
        "invoice_paid:email",
        "invoice_paid:in_app",
      ]);
    } finally {
      close();
    }
  });
});
