import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { createDatabase } from "../../client";
import type {
  CloudflareD1DatabaseBinding,
  CloudflareD1PreparedStatementBinding,
} from "../../client";
import { deleteChatFeedback, upsertChatFeedback } from "../chat-feedback";

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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0011_chat_feedback.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    d1,
    sqlite,
    close: () => sqlite.close(),
  };
}

describe("chat feedback D1", () => {
  test("upserts and deletes feedback in D1", async () => {
    const { d1, sqlite, close } = createD1();
    const db = createDatabase({
      cloudflare: { d1 },
    });

    try {
      await expect(
        upsertChatFeedback(db, {
          chatId: "chat-1",
          messageId: "message-1",
          userId: "user-1",
          teamId: "team-1",
          type: "positive",
          comment: "useful",
        }),
      ).resolves.toEqual({ success: true });

      expect(
        sqlite.prepare("select type, comment from chat_feedback where chat_id = ?").get("chat-1"),
      ).toMatchObject({
        type: "positive",
        comment: "useful",
      });

      await expect(
        upsertChatFeedback(db, {
          chatId: "chat-1",
          messageId: "message-1",
          userId: "user-1",
          teamId: "team-1",
          type: "negative",
        }),
      ).resolves.toEqual({ success: true });

      expect(
        sqlite.prepare("select type, comment from chat_feedback where chat_id = ?").get("chat-1"),
      ).toMatchObject({
        type: "negative",
        comment: null,
      });

      await expect(
        deleteChatFeedback(db, {
          chatId: "chat-1",
          messageId: "message-1",
          userId: "user-1",
        }),
      ).resolves.toEqual({ success: true });

      expect(sqlite.prepare("select count(*) as count from chat_feedback").get()).toEqual({
        count: 0,
      });
    } finally {
      close();
    }
  });
});
