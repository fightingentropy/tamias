import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { DEFAULT_WIDGET_PREFERENCES } from "@tamias/domain";
import { createDatabase } from "../../client";
import type {
  CloudflareD1DatabaseBinding,
  CloudflareD1PreparedStatementBinding,
} from "../../client";
import { getWidgetPreferences, updateWidgetPreferences } from "../widget-preferences";

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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0012_widget_preferences.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    d1,
    close: () => sqlite.close(),
  };
}

describe("widget preferences D1", () => {
  test("returns defaults and stores updated preferences in D1", async () => {
    const { d1, close } = createD1();
    const db = createDatabase({
      cloudflare: { d1 },
    });

    try {
      await expect(
        getWidgetPreferences(db, {
          userId: null,
          teamId: "team-1",
          accessToken: "auth-token",
        }),
      ).resolves.toEqual(DEFAULT_WIDGET_PREFERENCES);
      await expect(
        getWidgetPreferences(db, {
          userId: "user-1",
          teamId: "team-1",
        }),
      ).resolves.toEqual(DEFAULT_WIDGET_PREFERENCES);

      const updated = await updateWidgetPreferences(db, {
        userId: "user-1",
        teamId: "team-1",
        primaryWidgets: ["inbox", "vault", "runway"],
      });

      expect(updated.primaryWidgets).toEqual(["inbox", "vault", "runway"]);
      await expect(
        getWidgetPreferences(db, {
          userId: "user-1",
          teamId: "team-1",
        }),
      ).resolves.toEqual(updated);
    } finally {
      close();
    }
  });
});
