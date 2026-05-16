import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { configureDatabaseRuntime } from "../../client";
import type {
  CloudflareD1DatabaseBinding,
  CloudflareD1PreparedStatementBinding,
} from "../../client";
import { AppDataChatMemoryProvider } from "../chat-memory";

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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0015_chat_memory.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    d1,
    close: () => sqlite.close(),
  };
}

describe("chat memory D1", () => {
  afterEach(() => {
    configureDatabaseRuntime(null);
  });

  test("stores working memory, chats, and messages in D1", async () => {
    const { d1, close } = createD1();
    configureDatabaseRuntime({
      cloudflare: { d1 },
    });
    const provider = new AppDataChatMemoryProvider();
    const createdAt = new Date("2026-05-15T10:00:00.000Z");
    const updatedAt = new Date("2026-05-15T10:05:00.000Z");

    try {
      await provider.updateWorkingMemory({
        scope: "chat",
        chatId: "chat-1",
        content: "remember this",
      });
      await expect(
        provider.getWorkingMemory({
          scope: "chat",
          chatId: "chat-1",
        }),
      ).resolves.toMatchObject({
        content: "remember this",
      });

      await provider.saveChat({
        chatId: "chat-1",
        userId: "user-1",
        title: "First chat",
        createdAt,
        updatedAt,
        messageCount: 2,
      });
      await provider.saveMessage({
        chatId: "chat-1",
        userId: "user-1",
        role: "user",
        content: { text: "hello" },
        timestamp: createdAt,
      });
      await provider.saveMessage({
        chatId: "chat-1",
        userId: "user-1",
        role: "assistant",
        content: { text: "hi" },
        timestamp: updatedAt,
      });

      await expect(provider.getChat("chat-1")).resolves.toMatchObject({
        chatId: "chat-1",
        userId: "user-1",
        title: "First chat",
        messageCount: 2,
      });
      await expect(provider.getChats({ userId: "user-1" })).resolves.toEqual([
        expect.objectContaining({ chatId: "chat-1" }),
      ]);
      await expect(provider.getMessages<{ text: string }>({ chatId: "chat-1" })).resolves.toEqual([
        { text: "hello" },
        { text: "hi" },
      ]);

      await provider.updateChatTitle("chat-1", "Renamed chat");
      await expect(provider.getChat("chat-1")).resolves.toMatchObject({
        title: "Renamed chat",
      });

      await provider.deleteChat("chat-1");
      await expect(provider.getChat("chat-1")).resolves.toBeNull();
      await expect(provider.getMessages({ chatId: "chat-1" })).resolves.toEqual([]);
    } finally {
      close();
    }
  });
});
